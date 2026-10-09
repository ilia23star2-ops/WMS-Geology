"""
ViewSets приложения samples.

Справочники: ResearchTypeViewSet, SiteViewSet, LaboratoryViewSet.
Модели: WellViewSet, SampleViewSet, SampleWorkOrderViewSet.
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.work_orders.models import WorkOrder

from .catalogs import Laboratory, ResearchType, Site
from .models import Sample, SampleWorkOrder, Well
from .serializers import (
    LaboratorySerializer,
    ResearchTypeSerializer,
    SampleSerializer,
    SampleWorkOrderSerializer,
    SiteSerializer,
    WellSerializer,
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


class SampleViewSet(viewsets.ModelViewSet):
    """
    CRUD для проб.

    Фильтры:
    - sample_number — точное совпадение;
    - research_type — ID типа исследования;
    - research_type_code — код типа (ШЛ, ХА);
    - site — ID участка;
    - site_code — код участка (TST);
    - well_id, container_id, status;
    - work_order=<order_number> — по номеру Н/З (с linked_order);
    - show_disposed=true — показать утилизированные.
    """

    serializer_class = SampleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Sample.objects.select_related(
            "container", "well", "current_work_order",
            "research_type", "site",
        ).all()

        show_disposed = self.request.query_params.get("show_disposed")
        if show_disposed is None or show_disposed.lower() not in ("1", "true", "yes"):
            qs = qs.exclude(status=Sample.STATUS_DISPOSED)

        p = self.request.query_params

        if p.get("sample_number"):
            qs = qs.filter(sample_number=p["sample_number"])
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
            qs = qs.filter(work_order_links__work_order_id__in=all_ids)

        return qs.distinct()


class SampleWorkOrderViewSet(viewsets.ModelViewSet):
    """CRUD для связей проба ↔ Н/З. Фильтры: ?sample_id=, ?work_order_id="""

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