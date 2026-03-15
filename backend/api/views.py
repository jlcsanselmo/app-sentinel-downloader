from django.shortcuts import render
import geopandas as gpd
import json
import rasterio
import tempfile
import os
from rasterio.windows import from_bounds
from rasterio.warp import transform_bounds
from django.http import FileResponse
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
                assets = item.assets
                resultados.append({
                    'id': item.id,
                    'nuvens': item.properties.get('eo:cloud_cover', 100), 
                    'data_captura': item.datetime.strftime("%d/%m/%Y %H:%M"),
                    'geometria': item.geometry, 
                    
                    
                    'bandas': {
                        'b02': assets['blue'].href if 'blue' in assets else '',
                        'b03': assets['green'].href if 'green' in assets else '',
                        'b04': assets['red'].href if 'red' in assets else '',
                        'b08': assets['nir'].href if 'nir' in assets else '',
                    }
                })
            return JsonResponse({'status': 'sucesso', 'quantidade': len(resultados), 'imagens': resultados})

        except Exception as e:
            return JsonResponse({'status': 'erro', 'mensagem': f'Erro na busca: {str(e)}'}, status=400)

    return JsonResponse({'status': 'erro', 'mensagem': 'Método inválido.'}, status=400)

@csrf_exempt
def processar_bandas(request):
    if request.method == 'POST':
        try:
            dados = json.loads(request.body)
            bandas = dados.get('bandas')
            
            # Não precisamos mais do BBOX, pois vamos baixar a grade inteira!

            # A ordem exata: Bandas 2, 3, 4 e 8
            urls = [bandas['b02'], bandas['b03'], bandas['b04'], bandas['b08']]
            
            # Cria um arquivo temporário
            temp_file = os.path.join(tempfile.gettempdir(), 'sentinel_full_tile.tif')

            with rasterio.Env(AWS_NO_SIGN_REQUEST='YES'):
                
                # 1. Lemos os metadados da PRIMEIRA banda (da grade inteira)
                with rasterio.open(urls[0]) as src:
                    kwargs = src.meta.copy()
                    kwargs.update({
                        'count': 4 # Vamos guardar 4 bandas no arquivo final
                    })

                # 2. Cria o arquivo vazio e preenche com as bandas completas
                with rasterio.open(temp_file, 'w', **kwargs) as dst:
                    for i, url in enumerate(urls, start=1):
                        with rasterio.open(url) as src_banda:
                            # LÊ A IMAGEM INTEIRA DA NUVEM (sem o parâmetro window!)
                            dados_completos = src_banda.read(1)
                            dst.write(dados_completos, i) # Salva a banda (1 a 4)
                            
            # Envia o arquivo gigante de volta para o usuário
            response = FileResponse(open(temp_file, 'rb'), as_attachment=True, filename='sentinel_grade_completa_B2_B3_B4_B8.tif')
            return response

        except Exception as e:
            return JsonResponse({'status': 'erro', 'mensagem': f'Erro ao processar rasters: {str(e)}'}, status=500)

    return JsonResponse({'status': 'erro', 'mensagem': 'Método inválido.'}, status=400)