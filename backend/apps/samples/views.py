"""
ViewSets приложения samples.
"""

from collections import OrderedDict

from django.db.models import ProtectedError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.work_orders.models import WorkOrder

from .catalogs import Laboratory, ResearchType, Site
from .models import Sample, SampleWorkOrder, Well
from .serializers import (
    LaboratorySerializer,
    ResearchTypeSerializer,
    SampleGroupSerializer,
    SampleSerializer,
    SampleWorkOrderSerializer,
    SiteSerializer,
    WellSerializer,
    compute_sample_location,
)


# ============================================================
# Справочники
# ============================================================
class ResearchTypeViewSet(viewsets.ModelViewSet):
    """CRUD для типов исследования. Фильтр: ?is_active="""

    serializer_class = ResearchTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ResearchType.objects.all()
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))
        return qs


class SiteViewSet(viewsets.ModelViewSet):
    """CRUD для участков. Фильтр: ?is_active="""

    serializer_class = SiteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Site.objects.all()
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))
        return qs


class LaboratoryViewSet(viewsets.ModelViewSet):
    """CRUD для лабораторий. Фильтр: ?is_active="""

    serializer_class = LaboratorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Laboratory.objects.all()
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))
        return qs


# ============================================================
# Модели
# ============================================================
class WellViewSet(viewsets.ModelViewSet):
    """CRUD для скважин. Фильтр: ?cluster="""

    serializer_class = WellSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Well.objects.all()
        cluster = self.request.query_params.get("cluster")
        if cluster:
            qs = qs.filter(cluster=cluster)
        return qs


def _describe_protected(objects) -> str:
    counts: dict[str, int] = {}
    for obj in objects:
        label = str(obj._meta.verbose_name_plural)
        counts[label] = counts.get(label, 0) + 1
    return ", ".join(f"{k}: {v}" for k, v in counts.items())


class SampleViewSet(viewsets.ModelViewSet):
    """
    CRUD для проб.
    """
    serializer_class = SampleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Sample.objects.select_related(
            "container",
            "container__pallet",
            "container__pallet__cell",
            "container__floor_room",
            "well",
            "current_work_order",
            "research_type",
            "site",
        ).all()

        show_disposed = self.request.query_params.get("show_disposed")
        if show_disposed is None or show_disposed.lower() not in ("1", "true", "yes"):
            qs = qs.exclude(status=Sample.STATUS_DISPOSED)

        p = self.request.query_params

        q = p.get("q")
        if q:
            qs = qs.filter(sample_number__icontains=q)
        elif p.get("sample_number"):
            qs = qs.filter(sample_number__icontains=p["sample_number"])

        if p.get("research_type"):
            qs = qs.filter(research_type_id=p["research_type"])
        if p.get("research_type_code"):
            qs = qs.filter(research_type__code=p["research_type_code"])
        if p.get("site"):
            qs = qs.filter(site_id=p["site"])
        if p.get("site_code"):
            qs = qs.filter(site__code=p["site_code"])
        if p.get("well_id"):
            qs = qs.filter(well_id=p["well_id"])
        if p.get("container_id"):
            qs = qs.filter(container_id=p["container_id"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])

        no_work_order = p.get("no_work_order")
        if no_work_order is not None and no_work_order.lower() in (
            "1", "true", "yes",
        ):
            qs = qs.filter(current_work_order__isnull=True)

        work_order_number = p.get("work_order")
        if work_order_number:
            work_order_ids = set(
                WorkOrder.objects.filter(
                    order_number=work_order_number
                ).values_list("id", flat=True)
            )
            linked_ids = set(
                WorkOrder.objects.filter(
                    id__in=work_order_ids
                ).exclude(
                    linked_order__isnull=True
                ).values_list("linked_order_id", flat=True)
            )
            all_ids = work_order_ids | linked_ids
            qs = qs.filter(
                work_order_links__work_order_id__in=all_ids,
            ).distinct()

        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError as exc:
            return Response(
                {
                    "error": (
                        "Нельзя удалить пробу: на неё ссылаются "
                        f"связанные объекты ({len(exc.protected_objects)})."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _get_sample_any(self, pk: int) -> Sample | None:
        return Sample.objects.filter(pk=pk).first()

    @action(detail=True, methods=["post"], url_path="dispose")
    def dispose(self, request, pk=None):
        sample = self._get_sample_any(pk)
        if sample is None:
            return Response(
                {"error": "Проба не найдена."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if sample.status == Sample.STATUS_DISPOSED:
            return Response(
                {"error": "Проба уже утилизирована."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = (request.data.get("disposal_reason") or "").strip()

        sample.status = Sample.STATUS_DISPOSED
        sample.disposed_at = timezone.now()
        sample.disposed_by = request.user
        sample.disposal_reason = reason
        sample.save(update_fields=[
            "status", "disposed_at", "disposed_by", "disposal_reason",
        ])

        return Response(SampleSerializer(sample).data)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        sample = self._get_sample_any(pk)
        if sample is None:
            return Response(
                {"error": "Проба не найдена."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if sample.status != Sample.STATUS_DISPOSED:
            return Response(
                {"error": "Проба не находится в статусе «Утилизирована»."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sample.status = Sample.STATUS_IN_STORAGE
        sample.disposed_at = None
        sample.disposed_by = None
        sample.disposal_reason = ""
        sample.save(update_fields=[
            "status", "disposed_at", "disposed_by", "disposal_reason",
        ])

        return Response(SampleSerializer(sample).data)

    @action(detail=False, methods=["get"], url_path="grouped")
    def grouped(self, request):
        """
        Сгруппированный список проб.
        """
        per_page = 20
        qs = self.get_queryset()

        samples = list(
            qs.select_related(
                "container",
                "container__pallet",
                "container__pallet__cell",
                "container__floor_room",
                "current_work_order",
                "research_type",
            ).order_by(
                "current_work_order__order_number",
                "research_type__code",
                "container__container_number",
                "sample_number",
            )
        )

        if not samples:
            return Response({
                "count": 0,
                "next": None,
                "previous": None,
                "page_size": per_page,
                "results": [],
            })

        groups_map: "OrderedDict[tuple, dict]" = OrderedDict()
        for s in samples:
            key = (s.current_work_order_id, s.research_type_id)
            if key not in groups_map:
                groups_map[key] = {
                    "work_order": s.current_work_order,
                    "research_type": s.research_type,
                    "containers": OrderedDict(),
                    "total_samples": 0,
                }
            g = groups_map[key]
            g["total_samples"] += 1

            cid = s.container_id
            if cid not in g["containers"]:
                g["containers"][cid] = {
                    "container": s.container,
                    "samples": [],
                }
            g["containers"][cid]["samples"].append(s)

        groups_list = list(groups_map.values())

        try:
            page = int(request.query_params.get("page", 1))
        except (TypeError, ValueError):
            page = 1
        if page < 1:
            page = 1

        total = len(groups_list)
        start = (page - 1) * per_page
        end = start + per_page
        page_groups = groups_list[start:end]

        results = []
        for g in page_groups:
            containers_data = []
            for cdata in g["containers"].values():
                c = cdata["container"]
                # 2f-11c: Достаем cell_id и pallet_id для перехода
                pallet = c.pallet
                cell_id = pallet.cell_id if pallet else None
                pallet_id = pallet.id if pallet else None

                containers_data.append({
                    "container": {
                        "id": c.id,
                        "number": c.container_number,
                        "status": c.status,
                        "cell_id": cell_id,
                        "pallet_id": pallet_id,
                    },
                    "location": compute_sample_location(c),
                    "samples": [
                        {
                            "id": s.id,
                            "sample_number": s.sample_number,
                            "status": s.status,
                            "updated_at": s.updated_at,
                        }
                        for s in cdata["samples"]
                    ],
                })

            wo = g["work_order"]
            rt = g["research_type"]
            results.append({
                "work_order": (
                    {
                        "id": wo.id,
                        "number": wo.order_number,
                        "type": wo.order_type,
                    }
                    if wo is not None
                    else None
                ),
                "research_type": {
                    "id": rt.id,
                    "code": rt.code,
                    "name": rt.name,
                },
                "total_samples": g["total_samples"],
                "containers": containers_data,
            })

        base_url = request.build_absolute_uri(request.path)
        next_url = f"{base_url}?page={page + 1}" if end < total else None
        prev_url = f"{base_url}?page={page - 1}" if page > 1 else None

        return Response({
            "count": total,
            "next": next_url,
            "previous": prev_url,
            "page_size": per_page,
            "results": SampleGroupSerializer(results, many=True).data,
        })


class SampleWorkOrderViewSet(viewsets.ModelViewSet):
    serializer_class = SampleWorkOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = SampleWorkOrder.objects.select_related("sample", "work_order").all()
        sample_id = self.request.query_params.get("sample_id")
        if sample_id:
            qs = qs.filter(sample_id=sample_id)
        work_order_id = self.request.query_params.get("work_order_id")
        if work_order_id:
            qs = qs.filter(work_order_id=work_order_id)
        return qs