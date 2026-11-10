from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Pool, PoolItem
from .serializers import PoolSerializer
from apps.storage.models import Container
from apps.samples.models import Sample


class PoolViewSet(viewsets.ModelViewSet):
    """
    Буфер пользователя.
    """
    serializer_class = PoolSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # У каждого пользователя только один пул
        return Pool.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        pool = self.get_object()
        serializer = self.get_serializer(pool)
        return Response(serializer.data)

    def get_object(self):
        # Если пула нет — создаем при первом обращении
        pool, _ = Pool.objects.get_or_create(user=self.request.user)
        return pool

    @action(detail=False, methods=["post"], url_path="add")
    def add_items(self, request):
        """Добавить тары или пробы в пул."""
        pool = self.get_object()
        container_ids = request.data.get("container_ids") or []
        sample_ids = request.data.get("sample_ids") or []

        added = 0
        if container_ids:
            containers = Container.objects.filter(id__in=container_ids)
            for c in containers:
                _, created = PoolItem.objects.get_or_create(pool=pool, container=c)
                if created: added += 1

        if sample_ids:
            samples = Sample.objects.filter(id__in=sample_ids)
            for s in samples:
                _, created = PoolItem.objects.get_or_create(pool=pool, sample=s)
                if created: added += 1

        return Response({"added": added, "pool": PoolSerializer(pool).data})


    @action(detail=False, methods=['post'], url_path='remove')
    def remove_items(self, request):
        pool = self.get_object()
        item_ids = request.data.get('item_ids') or []
        if not item_ids:
            return Response({'error': 'Не переданы item_ids'}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = pool.items.filter(id__in=item_ids).delete()
        return Response({'removed': deleted})

    @action(detail=False, methods=["post"], url_path="clear")
    def clear(self, request):
        """Очистить пул."""
        pool = self.get_object()
        pool.items.all().delete()
        return Response({"status": "cleared"})