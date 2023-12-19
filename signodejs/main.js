import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM, Vector as VectorSource } from 'ol/source';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import Select from 'ol/interaction/Select';
import { pointerMove } from 'ol/events/condition';
import Overlay from 'ol/Overlay';
import { fromLonLat } from 'ol/proj';
import * as proj from 'ol/proj';
import * as format from "ol/format";
import {log} from "ol/console";
import {GeoJSON, WFS} from "ol/format";
import * as filter from "ol/format/filter";

const osm = new TileLayer({
    extent: proj.transformExtent([1.92, 47.838, 1.95, 47.85], 'EPSG:4326', 'EPSG:3857'),
    source: new OSM(),
});

document.getElementById("bourges").addEventListener("click", function() {
    loadData('campus', 'Bourges').then(r => {

    });
});
document.getElementById("orleans").addEventListener("click", function() {
    loadData('nom', 'EGS').then(r => {});
});

export async function loadData(propriete,value) {

    try {
        const url = buildUrlFilter(propriete, value);

        // Faites la requête pour obtenir les nouvelles données
        const response = await fetch(url);
        const data = await response.json();

        // Mettez à jour les données du vectorLayer
        vectorLayer.getSource().clear();

        // Assurez-vous de spécifier la projection si elle n'est pas incluse dans le GeoJSON
        const features = new format.GeoJSON().readFeatures(data, {
            dataProjection: 'EPSG:4326', // Projection des données (peut varier selon votre cas)
            featureProjection: 'EPSG:3857', // Projection pour affichage sur la carte (peut varier selon votre cas)
        });

        vectorLayer.getSource().addFeatures(features);

        // Redessinez la couche vectorielle
        vectorLayer.getSource().changed();

        // Vous pouvez également ajuster le centrage/zoom de la carte si nécessaire
        // map.getView().fit(vectorLayer.getSource().getExtent());

    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
    }
}

const vectorLayer = new VectorLayer({
    source: new VectorSource({
        url: 'http://localhost:8080/geoserver/projet/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=projet%3Abatiments&maxFeatures=50&outputFormat=application%2Fjson',
        format: new format.GeoJSON(),
    }),
    style: new Style({
        image: new Circle({
            radius: 6,
            fill: new Fill({
                color: 'red',
            }),
            stroke: new Stroke({
                color: 'white',
                width: 2,
            }),
        }),
    }),
});

    const map = new Map({
        target: 'map',
        layers: [osm, vectorLayer],
        view: new View({
            center: fromLonLat([1.934, 47.844]),
            zoom: 17,
        }),
    });


    const highlightSource = new VectorSource();
    const highlightLayer = new VectorLayer({
        source: highlightSource,
        style: new Style({
            image: new Circle({
                radius: 8,
                fill: new Fill({
                    color: 'yellow',
                }),
                stroke: new Stroke({
                    color: 'red',
                    width: 2,
                }),
            }),
        }),
    });

    map.addLayer(highlightLayer);

    const select = new Select({
        layers: [vectorLayer],
        condition: pointerMove,
        style: new Style({
            image: new Circle({
                radius: 8,
                fill: new Fill({
                    color: 'yellow',
                }),
                stroke: new Stroke({
                    color: 'red',
                    width: 2,
                }),
            }),
        }),
    });

    map.addInteraction(select);

    select.on('select', event => {
        highlightSource.clear();
        if (event.selected.length > 0) {
            highlightSource.addFeature(event.selected[0]);
        }
    });

    const popup = new Overlay({
        element: document.getElementById('popup'),
        positioning: 'bottom-center',
        offset: [0, -10],
        autoPan: true,
        autoPanAnimation: {
            duration: 250,
        },
    });

    popup.getElement().classList.add('popup-container');

    map.addOverlay(popup);


    map.on('singleclick', event => {
        const feature = map.forEachFeatureAtPixel(event.pixel, feature => feature);

        if (feature) {
            const properties = feature.getProperties();
            popup.setPosition(event.coordinate);
            document.getElementById('popup').innerHTML = '<p class="title-batiment">' + properties.nom + ' ' + properties.composante + "</p>";
            popup.getElement().style.display = 'block';
            console.log('Propriétés de l\'entité :', properties.nom + feature.id_);
            let id = feature.id_.replace('batiments.','');
    
            // associate service to batiment
            requeteFilter('batiment_service', 'batiment_id', id)
                .then(features => {
                    if (features.length > 0 ){
                        document.getElementById('popup').innerHTML += "<i>Services :</i>";
                    }
                    for(let i = 0; i < features.length; i++){
                        const serviceId = features[i].getProperties().service_id;
                        requeteId('services',serviceId).then((featureservice) => {
    
                            document.getElementById('popup').innerHTML += "<br>" + featureservice[0].getProperties().nom_service + ' : <span id="desc"> ' + featureservice[0].getProperties().description_service + "</span> destiné à " + featureservice[0].getProperties().public_cible;
                        })
                    }
                })
                .catch(error => {
                    // Gérez les erreurs
                    console.error('Une erreur s\'est produite :', error);
                });

        } else {
            document.getElementById('popup').innerHTML = '';
            popup.getElement().style.display = 'none';
        }
    });

async function requeteFilter(type, propriete, value) {
    try {
        // Generate a GetFeature request
        const featureRequest = new WFS().writeGetFeature({
            srsName: 'EPSG:4326',
            featureNS: 'projet',
            featurePrefix: 'projet',
            featureTypes: [type],
            outputFormat: 'application/json',
            filter: filter.equalTo(propriete, value),
        });

        // Post the request and add the received features to a layer
        const response = await fetch('http://localhost:8080/geoserver/wfs', {
            method: 'POST',
            body: new XMLSerializer().serializeToString(featureRequest),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const json = await response.json();
        const features = new GeoJSON().readFeatures(json);

        return features;

    } catch (error) {
        console.error('Error in requete:', error);
    }
}



async function requeteId(type, value) {
    try {
        const url = 'http://localhost:8080/geoserver/wfs?' +
            'request=GetFeature&' +
            'version=1.1.0&' +
            'typeName=projet:' + type + '&' +
            'outputFormat=json&' +
            'FEATUREID=' + type + '.' + value;

// Utilisation de fetch pour effectuer la requête
        const response = await fetch(url);


        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const json = await response.json();

        const features = new GeoJSON().readFeatures(json);

        return features;


    }catch (error) {
        console.error('Error in requete:', error);
    }
}

function buildUrlFilter(propriete,value) {
    // Paramètres de base de l'URL
    var urlBase = "http://localhost:8080/geoserver/projet/ows";
    var service = "WFS";
    var version = "1.0.0";
    var request = "GetFeature";
    var typeName = "projet:batiments";
    var maxFeatures = 100;
    var outputFormat = "application/json";

    // Filtre CQL
    var cqlFilter = "CQL_FILTER="+propriete+"%20=%20%27"+value+"%27";

    // Construction de l'URL complète
    var url = `${urlBase}?service=${service}&version=${version}&request=${request}&typeName=${typeName}&maxFeatures=${maxFeatures}&outputFormat=${outputFormat}&${cqlFilter}`;
    console.log(url);
    return url;
}

