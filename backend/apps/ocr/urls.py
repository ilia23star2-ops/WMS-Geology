from django.urls import path
from .views import OcrRecognizeView

urlpatterns = [
    path('recognize/', OcrRecognizeView.as_view(), name='ocr-recognize'),
]