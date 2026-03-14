// Inicializando o mapa
let bboxAtual = null;
const map = new maplibregl.Map({
    container: 'map',
    style: {
        'version': 8,
        'sources': {
            'osm': {
                'type': 'raster',
                'tiles': [
                    'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'
                ],
                'tileSize': 256,
                'attribution': '&copy; OpenStreetMap Contributors'
            }
        },
        'layers': [
            {
                'id': 'osm-layer',
                'type': 'raster',
                'source': 'osm',
                'minzoom': 0,
                'maxzoom': 19
            }
        ]
    },
    center: [-47.8103, -21.1704], // Coordenadas iniciais (Ribeirão Preto!)
    zoom: 10
});

map.addControl(new maplibregl.NavigationControl());

// -------------------------------------------------------------------
// 1. FUNÇÃO DO UPLOAD DO SHAPEFILE (Desenha o quadrado vermelho)
// -------------------------------------------------------------------
document.getElementById('upload-shapefile').addEventListener('change', async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://localhost:8000/api/upload-shapefile/', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();

        if (data.status === 'sucesso') {
            const bbox = data.bounding_box; 

            // Guarda as coordenadas globais e mostra o campo de busca
            bboxAtual = bbox;
            document.getElementById('busca-imagens').style.display = 'block';

            // Extrai as coordenadas e desenha o polígono no mapa
            const minLon = bbox[0], minLat = bbox[1], maxLon = bbox[2], maxLat = bbox[3];
            const coordenadasPoligono = [
                [
                    [minLon, minLat], [maxLon, minLat], 
                    [maxLon, maxLat], [minLon, maxLat], 
                    [minLon, minLat] 
                ]
            ];

            if (map.getSource('area-interesse')) {
                map.removeLayer('area-interesse-layer');
                map.removeSource('area-interesse');
            }

            map.addSource('area-interesse', {
                'type': 'geojson',
                'data': {
                    'type': 'Feature',
                    'geometry': { 'type': 'Polygon', 'coordinates': coordenadasPoligono }
                }
            });

            map.addLayer({
                'id': 'area-interesse-layer',
                'type': 'fill',
                'source': 'area-interesse',
                'paint': {
                    'fill-color': '#ff0000',
                    'fill-opacity': 0.3,
                    'fill-outline-color': '#ff0000'
                }
            });

            // Dá o zoom para a área do shapefile
            map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 50 });

        } else {
            alert('Erro do servidor: ' + data.mensagem);
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        alert('Erro ao enviar o ficheiro. Verifique se o servidor Django está a correr.');
    }
});

// -------------------------------------------------------------------
// 2. FUNÇÃO DA BUSCA (Desenha a lista de imagens na tela)
// -------------------------------------------------------------------
document.getElementById('btn-buscar').addEventListener('click', async function() {
    const dataEscolhida = document.getElementById('data-imagem').value;
    
    if (!dataEscolhida || !bboxAtual) {
        alert('Por favor, faça o upload do Shapefile e escolha uma data.');
        return;
    }

    const btn = document.getElementById('btn-buscar');
    btn.innerText = 'Procurando no satélite... 🛰️';
    btn.disabled = true;

    try {
        const response = await fetch('http://localhost:8000/api/buscar-imagens/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bbox: bboxAtual, data: dataEscolhida })
        });
        
        const data = await response.json();

        if (data.status === 'sucesso') {
            const divResultados = document.getElementById('resultados-busca');
            divResultados.innerHTML = ''; // Limpa buscas anteriores

            // Se não achou nada nos últimos 30 dias
            if (data.quantidade === 0) {
                divResultados.innerHTML = '<p style="color: red; font-weight: bold;">Nenhuma imagem encontrada nesta janela de 30 dias. Tente outra data.</p>';
                return;
            }

            // Cria um título mostrando a quantidade
            const titulo = document.createElement('h4');
            titulo.innerText = `${data.quantidade} Imagens Encontradas:`;
            divResultados.appendChild(titulo);

            // Cria um cartão para cada imagem
            data.imagens.forEach(img => {
                const card = document.createElement('div');
                card.className = 'card-imagem';
                
                // Formata as nuvens para 2 casas decimais e decide a cor
                const nuvens = parseFloat(img.nuvens).toFixed(2);
                let corNuvem = nuvens < 10 ? '#28a745' : (nuvens < 50 ? '#ffc107' : '#dc3545');

                card.innerHTML = `
                    <h4>📅 ${img.data_captura}</h4>
                    <p>☁️ Cobertura de Nuvens: <span style="color: ${corNuvem}; font-weight: bold;">${nuvens}%</span></p>
                    <button class="btn-ver-mapa" data-id="${img.id}">Visualizar no Mapa</button>
                `;
                divResultados.appendChild(card);
            });

            // Adiciona a ação de clique nos novos botões
            document.querySelectorAll('.btn-ver-mapa').forEach(btn => {
                btn.addEventListener('click', function() {
                    const imageId = this.getAttribute('data-id');
                    alert('Em breve: A imagem ' + imageId + ' vai aparecer magicamente no mapa! 🛰️');
                });
            });

        } else {
            alert('Erro: ' + data.mensagem);
        }
    } catch (error) {
        console.error(error);
        alert('Erro ao contactar o servidor.');
    } finally {
        btn.innerText = 'Buscar Imagens do Sentinel-2';
        btn.disabled = false;
    }
});