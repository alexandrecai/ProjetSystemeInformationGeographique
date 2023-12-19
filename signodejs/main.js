import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM, Source, Vector as VectorSource } from 'ol/source';
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
import {Draw, Modify, Snap} from 'ol/interaction.js';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';


let drawing = false;

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
        document.getElementById('popup').innerHTML = '';
        popup.getElement().style.display = 'none';
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

const sourceLayer = new VectorSource({
    url: 'http://localhost:8080/geoserver/projet/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=projet%3Abatiments&maxFeatures=50&outputFormat=application%2Fjson',
    format: new format.GeoJSON(),
});

const vectorLayer = new VectorLayer({
    source: sourceLayer,
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

    if(feature && feature.id_ == undefined) {
        console.log("Michel c'est le Brazil");
        //console.log(JSON.stringify(feature));
        // Sélectionner l'élément avec l'ID 'popup'
        console.log(event.coordinate);
        popup.setPosition(event.coordinate);
        popup.getElement().style.display = 'block';

        const popupElement = document.getElementById('popup');

        const completed = false;

        // Construire le formulaire HTML
        const formulaireHTML = `
            <form id="formulaireBatiment">
                <label for="nomBatiment">Nom du bâtiment:</label>
                <input type="text" id="nomBatiment" name="nomBatiment" required>

                <br>

                <label for="descriptifBatiment">Descriptif:</label>
                <textarea id="composanteBatiment" name="composanteBatiment" required></textarea>

                <br>

                <button type="submit">Enregistrer</button>
            </form>
        `;

        // Injecter le formulaire dans l'élément 'popup'
        popupElement.innerHTML = formulaireHTML;
    
        feature.setId("batiments."+ Date.now());

        
        // Ajouter un gestionnaire d'événements pour le formulaire
        const formulaireBatiment = document.getElementById('formulaireBatiment');
        formulaireBatiment.addEventListener('submit', function (event) {
            event.preventDefault();                    
            const nomBatiment = document.getElementById('nomBatiment').value;
            const composanteBatiment = document.getElementById('composanteBatiment').value;
    
            const nouvellesInformations = {
                nom:nomBatiment,
                composante: composanteBatiment
            };

            feature.setProperties(nouvellesInformations);

            vectorLayer.getSource().addFeature(feature);

            completed = true;

            popupElement.innerHTML = '';
            popup.getElement().style.display = 'none';

        });

        if (!completed) {
            vectorLayer.getSource().removeFeature(feature);
            vectorLayer.getSource().changed();
        }

        
    }
    else if (feature && feature.id_ != undefined) {
        const properties = feature.getProperties();
        console.log(event.coordinate);
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



let draw, snap; // global so we can remove them later
let modify = new Modify({source: sourceLayer});

function addInteractions() {

    map.addInteraction(modify);

    console.log("Je dessine bro !");
    drawing = true;
    document.getElementById("buttonDrawing").style.backgroundColor = '#4CAF50';
    draw = new Draw({
    source: sourceLayer,
    type: "Point",
    });
    map.addInteraction(draw);
    snap = new Snap({source: sourceLayer});
    map.addInteraction(snap);
}

function removeInteractions() {
    console.log("Hors de question de dessiner ! ><");
    drawing = false;
    document.getElementById("buttonDrawing").style.backgroundColor = '';
    
    map.removeInteraction(modify);
    map.removeInteraction(draw);
    map.removeInteraction(snap);

    document.getElementById('popup').innerHTML = '';
    popup.getElement().style.display = 'none';

}

const button = document.createElement('button');
button.id="buttonDrawing";
button.textContent = "Edit";
button.style.display = 'block';
button.style.marginBottom = '10px';
button.addEventListener('click', () => { if (!drawing) {addInteractions()} else { removeInteractions()} });

// Positionnement en haut à droite
button.style.position = 'fixed';
button.style.top = '10px'; // Ajustez la valeur en fonction de votre mise en page
button.style.right = '10px'; // Ajustez la valeur en fonction de votre mise en page

// Ajouter le bouton au corps (body) du document
document.body.appendChild(button);

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


//retourne une liste avec tous les publics mais que 1 fois
function singleListTraitement(allPublics){
    const uniquePublicsSet = new Set();

    // Parcours du tableau d'entrée
    allPublics.forEach(publicList => {
        // Exclusion du préfixe "services." et division des publics
        const publicWithoutPrefix = publicList[1].replace('services.', '');
        const publics = publicWithoutPrefix.split('-');

        // Ajout de chaque public à l'ensemble
        publics.forEach(publicItem => {
            uniquePublicsSet.add(publicItem);
        });
    });

    // Conversion de l'ensemble en tableau pour la sortie
    const uniquePublicsList = Array.from(uniquePublicsSet);

    return uniquePublicsList;
    
}


// Ajoutez cette fonction pour créer les boutons des services et publics 
async function createButtons() {
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'button-container';
    buttonContainer.style.position = 'absolute';
    buttonContainer.style.top = '50%';
    buttonContainer.style.transform = 'translateY(-50%)';
    buttonContainer.style.left = '10px';
    document.body.appendChild(buttonContainer);

    const allServices = await getAllServices();
    //console.log('Noms des services disponibles :', allServices);

    var allPublics = await getAllPublics();
    allPublics = singleListTraitement(allPublics);
    //console.log('Noms des publics cibles :', allPublics);

    allServices.forEach(serviceName => {
        const button = document.createElement('button');
        button.textContent = serviceName[1];
        button.style.display = 'block';
        button.style.marginBottom = '10px';
        button.addEventListener('click', () => loadServices(serviceName[0]));
        buttonContainer.appendChild(button);
    });

    allPublics.forEach(publicCible => {
        const button = document.createElement('button');
        button.textContent = publicCible;
        button.style.display = 'block';
        button.style.marginBottom = '10px';
        button.addEventListener('click', () => loadPublics(publicCible));
        buttonContainer.appendChild(button);
    });

    const button = document.createElement('button');
    button.textContent = "Reset";
    button.style.display = 'block';
    button.style.marginBottom = '10px';
    button.addEventListener('click', () => resetBatiments());
    buttonContainer.appendChild(button);
}

  
  //recuperer tous les noms de services dans projet:services
  async function getAllServices() {
    try {
        const response = await fetch('http://localhost:8080/geoserver/projet/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=projet:services&outputFormat=application/json');

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const features = data.features;

        
        console.log('Liste des services :', features);

        // Extrait uniquement les noms des services
        const serviceNames = features.map(feature => [feature.id, feature.properties.nom_service]);
        //console.log('Noms des services disponibles :', serviceNames);

        return serviceNames;
    } catch (error) {
        console.error('Une erreur s\'est produite lors du chargement des services :', error);
    }
}

//recuperer tous les publics dans projet:services
async function getAllPublics() {
    try {
        const response = await fetch('http://localhost:8080/geoserver/projet/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=projet:services&outputFormat=application/json');

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const features = data.features;

        
        console.log('Liste des services :', features);

       
        const serviceNames = features.map(feature => [feature.id, feature.properties.public_cible]);
     

        return serviceNames;
    } catch (error) {
        console.error('Une erreur s\'est produite lors du chargement des services :', error);
    }
}


async function loadServices(serviceId) {
    try {
        document.getElementById('popup').innerHTML = '';
        popup.getElement().style.display = 'none';
        vectorLayer.getSource().clear();
        console.log("ID du service cliqué :" + serviceId);
        var features = await requeteFilter('batiment_service', 'service_id', serviceId.replace('services.', ''));
        for (let i = 0; i < features.length; i++) {
            var batimentId = features[i].getProperties().batiment_id;
            var featureBatiment = await requeteId('batiments', batimentId);
            featureBatiment.forEach(feature => {
                feature.getGeometry().transform('EPSG:4326', 'EPSG:3857');
            });

            vectorLayer.getSource().addFeatures(featureBatiment);
        }

        //console.log("ouais ouais les bats:" + bats);
        
        // Redessinez la couche vectorielle
        vectorLayer.getSource().changed();

    } catch (error) {
        // Gérez les erreurs
        console.error('Une erreur s\'est produite :', error);
    }
}

function resetBatiments() {
    
    document.getElementById('popup').innerHTML = '';
    popup.getElement().style.display = 'none';


    map.removeInteraction(modify);
    map.removeInteraction(draw);
    map.removeInteraction(snap);

    

    vectorLayer.getSource().refresh()


}




async function loadPublics(publicCible){
    //recuperer tous les services qui contiennent le publicCible dans la table projet:services
    //puis regarder dans projet:batiment_service les batiments en relation avec l'id des services que j'ai recuperé juste au dessus
    //enfin retrouver les batiments a afficher sur ma carte 

    try {
        document.getElementById('popup').innerHTML = '';
        popup.getElement().style.display = 'none';

        vectorLayer.getSource().clear();

        processPublicCible(publicCible);

       /* //methode getallServicesFrompublic(publicCible) qui retourne les id de tous les services qui contiennent le publicCible
        var serviceIds = getAllServicesFromPublic(publicCible);
        console.log("ici mec "+serviceIds);

        serviceIds.forEach(serviceId => {
            var features = await requeteFilter('batiment_service', 'service_id', serviceIds[0].replace('services.', ''));
            for (let i = 0; i < features.length; i++) {
                var batimentId = features[i].getProperties().batiment_id;
                var featureBatiment = await requeteId('batiments', batimentId);
                featureBatiment.forEach(feature => {
                    feature.getGeometry().transform('EPSG:4326', 'EPSG:3857');
                });

            vectorLayer.getSource().addFeatures(featureBatiment);
            }
        });
        
        

        //console.log("ouais ouais les bats:" + bats);
        
        // Redessinez la couche vectorielle
        vectorLayer.getSource().changed();*/

    } catch (error) {
        // Gérez les erreurs
        console.error('Une erreur s\'est produite :', error);
    }
   
}


async function processPublicCible(publicCible) {
    try {
        // Récupérer les IDs des services
        var serviceIds = await getAllServicesFromPublic(publicCible);
        console.log("IDs des services obtenus :", serviceIds);

        // Traiter chaque service
        for (let i = 0; i < serviceIds.length; i++) {
            var features = await requeteFilter('batiment_service', 'service_id', serviceIds[i].replace('services.', ''));
            for (let j = 0; j < features.length; j++) {
                var batimentId = features[j].getProperties().batiment_id;
                var featureBatiment = await requeteId('batiments', batimentId);
                featureBatiment.forEach(feature => {
                    feature.getGeometry().transform('EPSG:4326', 'EPSG:3857');
                });

                vectorLayer.getSource().addFeatures(featureBatiment);
            }
        }
    } catch (error) {
        // Gérer les erreurs
        console.error('Une erreur s\'est produite :', error);
    }
}


async function getAllServicesFromPublic(publicCible) {
    try {
        const response = await fetch('http://localhost:8080/geoserver/wfs?request=GetFeature&service=WFS&version=2.0.0&typeName=projet:services&outputFormat=application/json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const json = await response.json();
        const features = json.features;

        // Filtrer les services en fonction du public cible
        const filteredServices = features.filter(feature => feature.properties.public_cible.includes(publicCible));

        // Récupérer les IDs des services filtrés
        const serviceIds = filteredServices.map(service => service.id);

        console.log('IDs des services pour le public cible ' + publicCible + ' :', serviceIds);

        return serviceIds;

    } catch (error) {
        console.error('Une erreur s\'est produite lors du chargement des services :', error);
    }
}

  
// Appelez la fonction pour créer les boutons
createButtons();


