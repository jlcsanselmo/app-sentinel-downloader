// =======================================================================
// 1. INICIALIZAÇÃO DO MAPA (MAPLIBRE)
// =======================================================================
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
    center: [-47.8103, -21.1704], // Ribeirão Preto
    zoom: 10
});

map.addControl(new maplibregl.NavigationControl());

// =======================================================================
// 2. UPLOAD DO SHAPEFILE (Extrai BBOX e desenha polígono vermelho)
// =======================================================================
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

            // Limpa o desenho anterior se houver
            if (map.getSource('area-interesse')) {
                map.removeLayer('area-interesse-layer');
                map.removeSource('area-interesse');
            }

            // Adiciona a nova área ao mapa
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

            // Dá o zoom automático para a área do shapefile
            map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 50 });

        } else {
            alert('Erro do servidor: ' + data.mensagem);
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        alert('Erro ao enviar o ficheiro. Verifique se o servidor Django está a correr.');
    }
});

// =======================================================================
// 3. BUSCA DE IMAGENS SENTINEL-2 (Lista, Grade e Download)
// =======================================================================
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

            // Cria um cartão para cada imagem encontrada
            data.imagens.forEach(img => {
                const card = document.createElement('div');
                card.className = 'card-imagem';
                
                const nuvens = parseFloat(img.nuvens).toFixed(2);
                let corNuvem = nuvens < 10 ? '#28a745' : (nuvens < 50 ? '#ffc107' : '#dc3545');

                // Prepara os dados complexos para guardar nos botões HTML
                const geojsonStr = JSON.stringify(img.geometria).replace(/"/g, '&quot;');
                const bandasStr = JSON.stringify(img.bandas).replace(/"/g, '&quot;');

                card.innerHTML = `
                    <h4>📅 ${img.data_captura}</h4>
                    <p>☁️ Nuvens: <span style="color: ${corNuvem}; font-weight: bold;">${nuvens}%</span> | ID: <span style="font-size: 10px;">${img.id.split('_')[1]}</span></p>
                    
                    <button class="btn-ver-grade" style="background: #6c757d; color: white; padding: 5px; border: none; width: 100%; margin-bottom: 5px; cursor: pointer;" data-geo="${geojsonStr}">📍 Ver Grade no Mapa</button>
                    
                    <button class="btn-download-stack" style="background: #28a745; color: white; padding: 8px; border: none; width: 100%; border-radius: 4px; font-weight: bold; cursor: pointer;" data-bandas="${bandasStr}">📥 Baixar Imagem (Bandas 2, 3, 4 e 8)</button>
                `;
                divResultados.appendChild(card);
            });

            // -----------------------------------------------------------
            // AÇÃO A: Desenhar a GRADE do satélite no mapa
            // -----------------------------------------------------------
            document.querySelectorAll('.btn-ver-grade').forEach(btn => {
                btn.addEventListener('click', function() {
                    const geometria = JSON.parse(this.getAttribute('data-geo'));

                    if (map.getSource('grade-satelite')) {
                        map.removeLayer('grade-satelite-layer');
                        map.removeSource('grade-satelite');
                    }

                    // Desenha apenas o contorno (linha tracejada) da área fotografada
                    map.addSource('grade-satelite', {
                        'type': 'geojson',
                        'data': { 'type': 'Feature', 'geometry': geometria }
                    });

                    map.addLayer({
                        'id': 'grade-satelite-layer',
                        'type': 'line',
                        'source': 'grade-satelite',
                        'paint': {
                            'line-color': '#0000ff', // Linha azul
                            'line-width': 2,
                            'line-dasharray': [2, 2] // Efeito tracejado
                        }
                    });
                });
            });

            // -----------------------------------------------------------
            // AÇÃO B: Fazer o Download e Recorte das Bandas no Backend
            // -----------------------------------------------------------
            document.querySelectorAll('.btn-download-stack').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const bandas = JSON.parse(this.getAttribute('data-bandas'));
                    const btnClicado = this;
                    
                    // Feedback visual de que está a carregar
                    btnClicado.innerText = 'Processando recorte na nuvem... ⏳';
                    btnClicado.style.background = '#ffc107'; // Amarelo
                    btnClicado.disabled = true;

                    try {
                        // Envia as URLs das bandas e o BBOX para o Python usar o Rasterio
                        const response = await fetch('http://localhost:8000/api/processar-bandas/', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bandas: bandas, bbox: bboxAtual })
                        });

                        if (response.ok) {
                            // Recebe o arquivo .tif como um "Blob" e força o navegador a fazer o download
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'sentinel_stack_B2_B3_B4_B8.tif'; // Nome que vai ser guardado no seu PC
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            
                            // Volta o botão a verde
                            btnClicado.innerText = '✅ Download Concluído!';
                            btnClicado.style.background = '#28a745';
                        } else {
                            const data = await response.json();
                            alert('Erro no processamento: ' + data.mensagem);
                            btnClicado.innerText = '📥 Tentar Novamente';
                            btnClicado.style.background = '#dc3545';
                            btnClicado.disabled = false;
                        }
                    } catch (error) {
                        console.error('Erro:', error);
                        alert('Erro ao contactar o servidor.');
                        btnClicado.innerText = '📥 Tentar Novamente';
                        btnClicado.style.background = '#dc3545';
                        btnClicado.disabled = false;
                    }
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