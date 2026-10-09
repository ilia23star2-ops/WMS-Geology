"""
ViewSets приложения samples.

Справочники:
- ResearchTypeViewSet, SiteViewSet, LaboratoryViewSet.

Модели:
- WellViewSet, SampleViewSet (с ключевым фильтром по Н/З),
  SampleWorkOrderViewSet.
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
    """
    CRUD для типов исследования.

    Фильтры: ?is_active=
    """

    serializer_class = ResearchTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ResearchType.objects.all()
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(
                is_active=is_active.lower() in ("1", "true", "yes")
            )
        return qs


class SiteViewSet(viewsets.ModelViewSet):
    """
    CRUD для участков.

    Фильтры: ?is_active=
    """

    serializer_class = SiteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Site.objects.all()
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(
                is_active=is_active.lower() in ("1", "true", "yes")
            )
        return qs


class LaboratoryViewSet(viewsets.ModelViewSet):
    """
    CRUD для лабораторий.

    Фильтры: ?is_active=
    """

    serializer_class = LaboratorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Laboratory.objects.all()
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(
                is_active=is_active.lower() in ("1", "true", "yes")
            )
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
    - sample_number, research_type, site, well_id, container_id, status;
    - work_order=<order_number> — по номеру Н/З (с linked_order);
    - show_disposed=true — показать утилизированные.
    """

    serializer_class = SampleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Sample.objects.select_related(
            "container", "well", "current_work_order"
        ).all()

        # Скрываем утилизированные по умолчанию
        show_disposed = self.request.query_params.get("show_disposed")
        if show_disposed is None or show_disposed.lower() not in (
            "1", "true", "yes",
        ):
            qs = qs.exclude(status=Sample.STATUS_DISPOSED)

        sample_number = self.request.query_params.get("sample_number")
        if sample_number:
            qs = qs.filter(sample_number=sample_number)

        research_type = self.request.query_params.get("research_type")
        if research_type:
            qs = qs.filter(research_type=research_type)

        site = self.request.query_params.get("site")
        if site:
            qs = qs.filter(site=site)

        well_id = self.request.query_params.get("well_id")
        if well_id:
            qs = qs.filter(well_id=well_id)

        container_id = self.request.query_params.get("container_id")
        if container_id:
            qs = qs.filter(container_id=container_id)

        status_ = self.request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)

        # Ключевой фильтр: ?work_order=<order_number> с учётом linked_order
        work_order_number = self.request.query_params.get("work_order")
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
    """
    CRUD для связей проба ↔ Н/З.

    Фильтры: ?sample_id=, ?work_order_id=
    """

    serializer_class = SampleWorkOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = SampleWorkOrder.objects.select_related(
            "sample", "work_order"
        ).all()
        sample_id = self.request.query_params.get("sample_id")
        if sample_id:
            qs = qs.filter(sample_id=sample_id)
        work_order_id = self.request.query_params.get("work_order_id")
        if work_order_id:
            qs = qs.filter(work_order_id=work_order_id)
        return qs