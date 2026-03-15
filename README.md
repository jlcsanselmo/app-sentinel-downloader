# APP Sentinel-2 Downloader

![APP Preview](![alt text](image-1.png))

> Uma aplicação WebGIS Cloud-Native para busca e extração automatizada de imagens de satélite Sentinel-2 (Multiespectral) utilizando a API STAC da AWS.

## Sobre o Projeto

 Esta aplicação permite que o utilizador defina uma Área de Interesse (AoI) através de um Shapefile e extraia automaticamente as bandas essenciais (B2, B3, B4 e B8) para análises como composições RGB e cálculo de NDVI.

O sistema processa e empilha (*layer stack*) os ficheiros Cloud Optimized GeoTIFFs (COG) diretamente na nuvem antes do download final, garantindo velocidade e eficiência.

## Principais Funcionalidades

- ** Ingestão Espacial:** Upload de Shapefiles (`.zip`) e extração automática de Bounding Boxes (EPSG:4326) utilizando GeoPandas.
- ** Busca Inteligente (STAC API):** Integração com o catálogo `earth-search` da AWS para localizar passagens do satélite Sentinel-2 num raio temporal de 30 dias.
- **Visualização Interativa:** Renderização da Bounding Box e da grade (footprint) do satélite em tempo real utilizando MapLibre GL JS.
- **Geoprocessamento em Nuvem:** Leitura e empilhamento de múltiplas bandas multiespectrais em um único arquivo `.tif` utilizando a biblioteca Rasterio.
- **Ambiente Isolado:** Arquitetura 100% baseada em Docker (Frontend e Backend isolados), garantindo que o projeto rode em qualquer máquina sem conflitos de dependências.

## Tecnologias Utilizadas

**Backend (Cérebro & Geoprocessamento)**
- [Python 3](https://www.python.org/)
- [Django](https://www.djangoproject.com/) (API RESTful)
- [GeoPandas](https://geopandas.org/) (Manipulação de vetores)
- [Rasterio](https://rasterio.readthedocs.io/) (Manipulação de matrizes raster)
- [PySTAC Client](https://pystac-client.readthedocs.io/) (Comunicação com o catálogo de satélites)

**Frontend (Interface & WebGIS)**
- Vanilla JavaScript (ES6+)
- [Bootstrap 5](https://getbootstrap.com/) (UI/UX e Painel Flutuante)
- [MapLibre GL JS](https://maplibre.org/) (Renderização de mapas interativos)

**Infraestrutura**
- Docker & Docker Compose
- Nginx (Servidor Web Frontend)

## Como Executar o Projeto

Graças ao Docker, rodar este projeto localmente é extremamente simples. Não é necessário instalar o Python ou configurar bibliotecas geoespaciais complexas (como GDAL) na sua máquina host.

### Pré-requisitos
- [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/) instalados.

### Passos

1. Clone este repositório:
   ```bash
   git clone [https://github.com/SEU_USUARIO/app-sentinel-downloader.git](https://github.com/SEU_USUARIO/app-sentinel-downloader.git)
   cd app-sentinel-downloader