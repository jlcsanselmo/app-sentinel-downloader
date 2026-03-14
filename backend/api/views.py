from django.shortcuts import render
import geopandas as gpd
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from pystac_client import Client
from datetime import datetime, timedelta # ampliando data

@csrf_exempt

def upload_shapefile(request):
    if  request.method == 'POST' and request.FILES.get('file'):
        arquivo_zip = request.FILES['file']

        try:
            gdf  = gpd.read_file(arquivo_zip)
            gdf  = gdf.to_crs(epsg=4326)

            bbox = gdf.total_bounds

            return JsonResponse({
                'status': 'sucesso',
                'mensagem': 'Shapefile processado com sucesso',
                'bounding_box': list(bbox) 
            })
        except Exception as e:
            return JsonResponse({'status': 'erro', 'mensagem': f'Erro ao processar o arquivo: {str(e)}'}, status=400)

    return JsonResponse({'status': 'erro', 'mensagem': 'Por favor, envie um arquivo .zip contendo o Shapefile via POST.'}, status=400)

@csrf_exempt
def buscar_imagens_stac(request):
    if request.method == 'POST':
        try:
            dados = json.loads(request.body)
            bbox = dados.get('bbox')
            data_escolhida = dados.get('data')

            if not bbox or not data_escolhida:
                return JsonResponse({'status': 'erro', 'mensagem': 'BBOX e Data são obrigatórios.'}, status=400)

            data_fim = datetime.strptime(data_escolhida, "%Y-%m-%d")
            data_inicio = data_fim - timedelta(days=30)

            str_inicio = data_inicio.strftime("%Y-%m-%dT00:00:00Z")
            str_fim = data_fim.strftime("%Y-%m-%dT23:59:59Z")

            catalogo = Client.open("https://earth-search.aws.element84.com/v1")

            # Faz a busca usando a nossa janela de 30 dias!
            busca = catalogo.search(
                collections=["sentinel-2-l2a"],
                bbox=bbox,
                datetime=f"{str_inicio}/{str_fim}",
                max_items=10 # Traz as 10 imagens mais recentes desse período
            )

            itens = busca.item_collection()
            resultados = []
            
            for item in itens:
                resultados.append({
                    'id': item.id,
                    'nuvens': item.properties.get('eo:cloud_cover', 100), 
                    'data_captura': item.datetime.strftime("%d/%m/%Y %H:%M"),
                })

            return JsonResponse({'status': 'sucesso', 'quantidade': len(resultados), 'imagens': resultados})

        except Exception as e:
            return JsonResponse({'status': 'erro', 'mensagem': f'Erro na busca: {str(e)}'}, status=400)

    return JsonResponse({'status': 'erro', 'mensagem': 'Método inválido.'}, status=400)