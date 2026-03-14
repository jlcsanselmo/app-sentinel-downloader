from django.shortcuts import render
import geopandas as gpd
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt

def upload_shapefile(request):
    if  request.method == 'POST' and request.FILE.get('file'):
        arquivo_zip = request.FILES['file']

        try:
            gdf  = gpd.read_file(arquivo_zip)
            gdf  = gdf.to_crs(epsg=4326)

            bbox = gdf.total_bounds

            return JsonResponse({
                'status': 'sucesso',
                'mensagem': 'Shapefile processado com sucesso',
                'bbox': bbox.tolist()
            })
        except Exception as e:
            return JsonResponse({'status': 'erro', 'mensagem': f'Erro ao processar o arquivo: {str(e)}'}, status=400)

    return JsonResponse({'status': 'erro', 'mensagem': 'Por favor, envie um arquivo .zip contendo o Shapefile via POST.'}, status=400)