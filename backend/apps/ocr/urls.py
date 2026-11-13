from django.urls import path

from .views import (
    OcrBatchDetailView,
    OcrBatchListCreateView,
    OcrRecognizeView,
    OcrTaskApproveView,
    OcrTaskDetailView,
)

urlpatterns = [
    path('recognize/', OcrRecognizeView.as_view(), name='ocr-recognize'),
    path('batches/', OcrBatchListCreateView.as_view(), name='ocr-batch-list'),
    path('batches/<int:pk>/', OcrBatchDetailView.as_view(), name='ocr-batch-detail'),
    path('tasks/<int:pk>/', OcrTaskDetailView.as_view(), name='ocr-task-detail'),
    path('tasks/<int:pk>/approve/', OcrTaskApproveView.as_view(), name='ocr-task-approve'),
]