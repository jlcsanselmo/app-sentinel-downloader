// =======================================================================
// 1. INICIALIZAÇÃO DO MAPA
// =======================================================================
let bboxAtual = null;

const map = new maplibregl.Map({
    container: 'map',
    style: {
        'version': 8,
        'sources': {
            'osm': {
                'type': 'raster',
                'tiles': ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                'tileSize': 256,
                'attribution': '&copy; OpenStreetMap Contributors'
            }
        },
        'layers': [
            {'id': 'osm-layer', 'type': 'raster', 'source': 'osm', 'minzoom': 0, 'maxzoom': 19}
        ]
    },
    center: [-47.8103, -21.1704],
    zoom: 10
});
map.addControl(new maplibregl.NavigationControl());

// =======================================================================
// LÓGICA DA BARRA DE PROGRESSO INTELIGENTE
// =======================================================================
let progressInterval;

function startProgress() {
    const pContainer = document.getElementById('progress-container');
    const pBar = document.getElementById('progress-bar');
    const pText = document.getElementById('progress-text');
    
    // Mostra a barra e reseta cores/textos
    pContainer.classList.remove('d-none');
    pBar.className = 'progress-bar progress-bar-striped progress-bar-animated bg-primary';
    pBar.style.width = '0%';
    pBar.innerText = '0%';
    
    let progress = 0;
    
    // A cada 1 segundo, a barra sobe um pouco e a mensagem muda consoante o avanço
    progressInterval = setInterval(() => {
        // Aumenta de 2 a 5% por segundo aleatoriamente
        progress += Math.floor(Math.random() * 4) + 2; 
        
        // Trava nos 90% (fica à espera do servidor Python terminar o envio final)
        if (progress > 90) progress = 90; 
        
        pBar.style.width = progress + '%';
        pBar.innerText = progress + '%';
        
        if (progress < 30) {
            pText.innerText = '📡 A aceder ao Catálogo AWS Sentinel-2...';
        } else if (progress < 60) {
            pText.innerText = '📥 A transferir as Bandas 2, 3, 4 e 8 da nuvem...';
        } else {
            pText.innerText = '⚙️ A empilhar e a gerar o ficheiro TIF final...';
        }
    }, 1000);
}

function finishProgress(sucesso, mensagemErro = '') {
    clearInterval(progressInterval);
    const pBar = document.getElementById('progress-bar');
    const pText = document.getElementById('progress-text');
    const pContainer = document.getElementById('progress-container');
    
    if (sucesso) {
        pBar.style.width = '100%';
        pBar.innerText = '100%';
        pBar.className = 'progress-bar bg-success'; // Fica verde!
        pText.innerText = '✅ Download Concluído com Sucesso!';
        
        // Esconde a barra depois de 5 segundos
        setTimeout(() => pContainer.classList.add('d-none'), 5000);
    } else {
        pBar.className = 'progress-bar bg-danger'; // Fica vermelho!
        pText.innerText = '❌ ' + mensagemErro;
    }
}

// =======================================================================
// 2. UPLOAD DO SHAPEFILE
// =======================================================================
document.getElementById('upload-shapefile').addEventListener('change', async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://localhost:8000/api/upload-shapefile/', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.status === 'sucesso') {
            bboxAtual = data.bounding_box; 
            document.getElementById('busca-imagens').style.display = 'block';

            const minLon = bboxAtual[0], minLat = bboxAtual[1], maxLon = bboxAtual[2], maxLat = bboxAtual[3];
            const coords = [ [[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]] ];

            if (map.getSource('area-interesse')) {
                map.removeLayer('area-interesse-layer');
                map.removeSource('area-interesse');
            }

            map.addSource('area-interesse', { 'type': 'geojson', 'data': { 'type': 'Feature', 'geometry': { 'type': 'Polygon', 'coordinates': coords } } });
            map.addLayer({ 'id': 'area-interesse-layer', 'type': 'fill', 'source': 'area-interesse', 'paint': { 'fill-color': '#dc3545', 'fill-opacity': 0.3, 'fill-outline-color': '#dc3545' } });
            map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 50 });

        } else {
            alert('Erro: ' + data.mensagem);
        }
    } catch (error) {
        console.error(error);
        alert('Erro ao enviar ficheiro.');
    }
});

// =======================================================================
// 3. BUSCA E DOWNLOAD
// =======================================================================
document.getElementById('btn-buscar').addEventListener('click', async function() {
    const dataEscolhida = document.getElementById('data-imagem').value;
    if (!dataEscolhida || !bboxAtual) { alert('Escolha a data e o shapefile.'); return; }

    const btn = document.getElementById('btn-buscar');
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> A procurar...';
    btn.disabled = true;

    try {
        const response = await fetch('http://localhost:8000/api/buscar-imagens/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bbox: bboxAtual, data: dataEscolhida })
        });
        const data = await response.json();

        const divResultados = document.getElementById('resultados-busca');
        divResultados.innerHTML = ''; 

        if (data.status === 'sucesso') {
            if (data.quantidade === 0) {
                divResultados.innerHTML = '<div class="alert alert-warning">Nenhuma imagem nesta janela de 30 dias.</div>';
                return;
            }

            divResultados.innerHTML = `<h5 class="mb-3 text-secondary">${data.quantidade} Imagens Encontradas:</h5>`;

            data.imagens.forEach(img => {
                const card = document.createElement('div');
                card.className = 'card-imagem';
                
                const nuvens = parseFloat(img.nuvens).toFixed(2);
                let badgeClass = nuvens < 10 ? 'bg-success' : (nuvens < 50 ? 'bg-warning text-dark' : 'bg-danger');

                const geojsonStr = JSON.stringify(img.geometria).replace(/"/g, '&quot;');
                const bandasStr = JSON.stringify(img.bandas).replace(/"/g, '&quot;');

                card.innerHTML = `
                    <h5>📅 ${img.data_captura}</h5>
                    <p class="text-muted mb-2">ID: <span style="font-size: 11px;">${img.id.split('_')[1]}</span></p>
                    <p>☁️ Nuvens: <span class="badge ${badgeClass}">${nuvens}%</span></p>
                    
                    <button class="btn btn-outline-secondary btn-sm w-100 mb-2 btn-ver-grade" data-geo="${geojsonStr}">📍 Ver Grade no Mapa</button>
                    <button class="btn btn-success btn-sm w-100 fw-bold btn-download-stack" data-bandas="${bandasStr}">📥 Baixar Imagem Completa (B2,3,4,8)</button>
                `;
                divResultados.appendChild(card);
            });

            // AÇÃO: Ver Grade
            document.querySelectorAll('.btn-ver-grade').forEach(btn => {
                btn.addEventListener('click', function() {
                    const geometria = JSON.parse(this.getAttribute('data-geo'));
                    if (map.getSource('grade-satelite')) { map.removeLayer('grade-satelite-layer'); map.removeSource('grade-satelite'); }
                    map.addSource('grade-satelite', { 'type': 'geojson', 'data': { 'type': 'Feature', 'geometry': geometria } });
                    map.addLayer({ 'id': 'grade-satelite-layer', 'type': 'line', 'source': 'grade-satelite', 'paint': { 'line-color': '#0d6efd', 'line-width': 2, 'line-dasharray': [2, 2] } });
                });
            });

            // AÇÃO: Download com Barra de Progresso
            document.querySelectorAll('.btn-download-stack').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const bandas = JSON.parse(this.getAttribute('data-bandas'));
                    
                    // Inicia a barra de progresso!
                    startProgress();

                    // Bloqueia todos os botões de download para o utilizador não clicar várias vezes
                    document.querySelectorAll('.btn-download-stack').forEach(b => b.disabled = true);

                    try {
                        const response = await fetch('http://localhost:8000/api/processar-bandas/', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bandas: bandas, bbox: bboxAtual })
                        });

                        if (response.ok) {
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'sentinel_grade_completa_B2_B3_B4_B8.tif';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            
                            finishProgress(true); // Fica 100% verde!
                        } else {
                            const data = await response.json();
                            finishProgress(false, data.mensagem);
                        }
                    } catch (error) {
                        finishProgress(false, 'Falha na comunicação com o servidor.');
                    } finally {
                        // Desbloqueia os botões após terminar
                        document.querySelectorAll('.btn-download-stack').forEach(b => b.disabled = false);
                    }
                });
            });

        } else {
            alert('Erro: ' + data.mensagem);
        }
    } catch (error) {
        alert('Erro de rede.');
    } finally {
        btn.innerHTML = '🔍 Buscar Imagens do Sentinel-2';
        btn.disabled = false;
    }
});