// Inicializando o mapa
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

            map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 50 });

        } else {
            alert('Erro do servidor: ' + data.mensagem);
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        alert('Erro ao enviar o ficheiro. Verifique se o servidor Django está a correr.');
    }
});