
from django.contrib import admin
from django.urls import path
from api.views import upload_shapefile
from api.views import upload_shapefile, buscar_imagens_stac

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/upload-shapefile/', upload_shapefile, name='upload_shapefile'),
    path('api/buscar-imagens/', buscar_imagens_stac, name='buscar_imagens'),
]
