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
import {GeoJSON, WFS} from "ol/format";
import * as filter from "ol/format/filter";
import {Draw, Modify, Snap} from 'ol/interaction.js';


let drawing = false;
let listenNextClic = false;
let featureUpdate;

let tileGeoData;
let centerGeoData;

// get campus geo data
switch (window.location.pathname.split('/')[2].split('.')[0]) {
    case 'orleans': {
        tileGeoData = [1.88, 47.818, 1.98, 47.86];
        centerGeoData = [1.934, 47.844];
        break;
    }
    case 'bourges': {
        tileGeoData = [2.35,47.05,2.45,47.12];
        centerGeoData = [2.419,47.099];
        break;
    }
    case 'chateauroux': {
        tileGeoData = [1.61,46.78,1.75,46.85];
        centerGeoData = [1.685,46.811];
        break;
    }
    default: {
        tileGeoData = [1.88, 47.818, 1.98, 47.86];
        centerGeoData = [1.934, 47.844];
        break;
    }
}


const osm = new TileLayer({
    extent: proj.transformExtent(tileGeoData, 'EPSG:4326', 'EPSG:3857'),
    source: new OSM(),
});

document.getElementById("rechercheBatiment").addEventListener("click", function() {
    const recherche = document.getElementById('nomRecherche').value;
    console.log(recherche);
    loadData('nom', recherche).then(r => {});
});

export async function loadData(propriete,value) {

    try {
        document.getElementById('popup').innerHTML = '';
        popup.getElement().style.display = 'none';
        const url = buildUrlFilter(propriete, value);

        const response = await fetch(url);
        const data = await response.json();

        vectorLayer.getSource().clear();

        const features = new format.GeoJSON().readFeatures(data, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
        });

        vectorLayer.getSource().addFeatures(features);

        vectorLayer.getSource().changed();

        if(features.length>0) {
            map.getView().fit(vectorLayer.getSource().getExtent());
            map.getView().setZoom(19);
        }

    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
    }
}

const sourceLayer = new VectorSource({
    url: 'http://localhost:8080/geoserver/projet/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=projet%3Abatiments&maxFeatures=150&outputFormat=application%2Fjson',
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
        center: fromLonLat(centerGeoData),
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

        console.log(event.coordinate);
        popup.setPosition(event.coordinate);
        popup.getElement().style.display = 'block';

        const popupElement = document.getElementById('popup');

        var completed = false;

        const formulaireHTML = `
        <form id="formulaireBatiment">
            <label for="nomBatiment">Nom du bâtiment:</label>
            <input type="text" id="nomBatiment" name="nomBatiment" required>

            <br>

            <label for="composanteBatiment">Composante:</label>
            <input type="text" id="composanteBatiment" name="composanteBatiment" required>

            <br>
           
            
            <label for="cpBatiment">Code postal:</label>
            <input type="number" id="cpBatiment" name="cpBatiment" required>

            <br>
            
            <label for="rueBatiment">Rue:</label>
            <input type="text" id="rueBatiment" name="rueBatiment" required>

            <br>

            <button type="submit">Enregistrer</button>
        </form>
        `;


        popupElement.innerHTML = formulaireHTML;
    
        feature.setId("batiments."+ Date.now());

        const coordonnees = event.coordinate;

        const formulaireBatiment = document.getElementById('formulaireBatiment');
        formulaireBatiment.addEventListener('submit', function (event) {
            event.preventDefault();
            const nomBatiment = document.getElementById('nomBatiment').value;
            const composanteBatiment = document.getElementById('composanteBatiment').value;
            const rueBatiment = document.getElementById('rueBatiment').value;
            const cpBatiment = document.getElementById('cpBatiment').value;
    
            const nouvellesInformations = {
                nom:nomBatiment,
                composante: composanteBatiment
            };

            feature.setProperties(nouvellesInformations);

            vectorLayer.getSource().addFeature(feature);

            completed = true;

            popupElement.innerHTML = '';
            popup.getElement().style.display = 'none';

            let campus = '';
            switch (window.location.pathname.split('/')[2].split('.')[0]) {
                case 'orleans': {
                    campus = 'Orléans';
                    break;
                }
                case 'bourges': {
                    campus = 'Bourges';
                    break;
                }
                case 'chateauroux': {
                    campus = 'Chateauroux';
                    break;
                }
                default: {
                    campus = 'Orléans';
                    break;
                }
            }

            creerUnBatiment(coordonnees[0],coordonnees[1],composanteBatiment,nomBatiment,campus,cpBatiment,rueBatiment).then(r => {});

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
        document.getElementById('popup').innerHTML = '<p class="title-batiment">' + properties.nom + ' - ' + properties.composante;
        popup.getElement().style.display = 'block';

       
        let id = feature.id_.replace('batiments.','');

        // associate service to batiment
        requeteFilter('batiment_service', 'batiment_id', id)
            .then(features => {
                if (features.length > 0 ){
                    document.getElementById('popup').innerHTML += "<i>Services :</i>";
                }
                if (features.length == 0) {
                    document.getElementById('popup').innerHTML += "</p> <button id=\"modifierCoordonneesBtn\">Modifier Coordonnées</button>";

                    const btnModifierCoordonnees = document.getElementById("modifierCoordonneesBtn");

                    btnModifierCoordonnees.style.display = "block";
                    btnModifierCoordonnees.style.margin = "auto";
                    document.getElementById("modifierCoordonneesBtn").addEventListener("click", function() {
                        document.getElementById('popup').innerHTML = "<p> Cliquez sur la map pour déplacer le point ! </p>";
                            listenNextClic = true;
                            featureUpdate = feature;
                    });
                }
                for(let i = 0; i < features.length; i++){
                    const serviceId = features[i].getProperties().service_id;
                    requeteId('services',serviceId).then((featureservice) => {

                        document.getElementById('popup').innerHTML += "<br>" + featureservice[0].getProperties().nom_service + ' : <span id="desc"> ' + featureservice[0].getProperties().description_service + "</span> destiné à " + featureservice[0].getProperties().public_cible;
                    }).then(() => {
                       if(i==features.length-1){
                            document.getElementById('popup').innerHTML += "</p> <button id=\"modifierCoordonneesBtn\">Modifier Coordonnées</button>";
                            
                                // Sélectionnez le bouton par son ID
                            const btnModifierCoordonnees = document.getElementById("modifierCoordonneesBtn");

                            // Ajoutez un peu de style CSS pour centrer le bouton
                            btnModifierCoordonnees.style.display = "block";  // Assurez-vous que le bouton est un élément de type bloc
                            btnModifierCoordonnees.style.margin = "auto";   // Auto-marge horizontale
                            document.getElementById("modifierCoordonneesBtn").addEventListener("click", function() {
                            
                            document.getElementById('popup').innerHTML = "<p> Cliquez sur la map pour déplacer le point ! </p>";
                            listenNextClic = true;
                            featureUpdate = feature;
                            
                            
                            });
                        }
                    });
                }

                
        
            })
            .catch(error => {
                // Gérez les erreurs
                console.error('Une erreur s\'est produite :', error);
            });

       
    } 
    
    else if(listenNextClic) {

        const coordonneesLonLat = proj.toLonLat(event.coordinate, 'EPSG:3857');
        featureUpdate.getGeometry().setCoordinates(coordonneesLonLat);
        console.log("Regarde moi je t'en supplie" + featureUpdate.getGeometry().getCoordinates());
        modifyFeature(featureUpdate);
        listenNextClic = false;
    
    }
    
    else {
        document.getElementById('popup').innerHTML = '';
        popup.getElement().style.display = 'none';
    }
});



let draw, snap;
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
button.addEventListener('click', () => { if (!drawing) {addInteractions()} else { removeInteractions()} });


document.getElementById('nav').appendChild(button);

async function requeteFilter(type, propriete, value) {
    try {
        const featureRequest = new WFS().writeGetFeature({
            srsName: 'EPSG:4326',
            featureNS: 'projet',
            featurePrefix: 'projet',
            featureTypes: [type],
            outputFormat: 'application/json',
            filter: filter.equalTo(propriete, value),
        });

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

    var cqlFilter = "CQL_FILTER="+propriete+"%20=%20%27"+value+"%27";

    var url = `${urlBase}?service=${service}&version=${version}&request=${request}&typeName=${typeName}&maxFeatures=${maxFeatures}&outputFormat=${outputFormat}&${cqlFilter}`;
    console.log(url);
    return url;
}


//retourne une liste avec tous les publics mais que 1 fois
function singleListTraitement(allPublics){
    const uniquePublicsSet = new Set();

    allPublics.forEach(publicList => {
        const publicWithoutPrefix = publicList[1].replace('services.', '');
        const publics = publicWithoutPrefix.split('-');

        publics.forEach(publicItem => {
            uniquePublicsSet.add(publicItem);
        });
    });

    const uniquePublicsList = Array.from(uniquePublicsSet);

    return uniquePublicsList;
    
}

async function createButtons() {
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'button-container';
    buttonContainer.style.position = 'absolute';
    buttonContainer.style.top = '50%';
    buttonContainer.style.transform = 'translateY(-50%)';
    buttonContainer.style.left = '10px';
    document.body.appendChild(buttonContainer);

    const allServices = await getAllServices();

    var allPublics = await getAllPublics();
    allPublics = singleListTraitement(allPublics);

    allServices.forEach(serviceName => {
        const button = document.createElement('button');
        button.textContent = serviceName[1];
        button.classList.add('lavache');
        button.addEventListener('click', () => loadServices(serviceName[0]));
        buttonContainer.appendChild(button);
    });

    allPublics.forEach(publicCible => {
        const button = document.createElement('button');
        button.textContent = publicCible;
        button.classList.add('lavache');
        button.addEventListener('click', () => loadPublics(publicCible));
        buttonContainer.appendChild(button);
    });

    const button = document.createElement('button');
    button.textContent = "Reset";
    button.classList.add('lavache');
    button.addEventListener('click', () => resetBatiments());
    buttonContainer.appendChild(button);
}

  async function getAllServices() {
    try {
        const response = await fetch('http://localhost:8080/geoserver/projet/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=projet:services&outputFormat=application/json');

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const features = data.features;

        
        console.log('Liste des services :', features);

        const serviceNames = features.map(feature => [feature.id, feature.properties.nom_service]);

        return serviceNames;
    } catch (error) {
        console.error('Une erreur s\'est produite lors du chargement des services :', error);
    }
}

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
        vectorLayer.getSource().changed();

    } catch (error) {
        console.error('Une erreur s\'est produite :', error);
    }
}

function resetBatiments() {
    
    document.getElementById('popup').innerHTML = '';
    popup.getElement().style.display = 'none';

    document.getElementById('nomRecherche').value = '';

    map.removeInteraction(modify);
    map.removeInteraction(draw);
    map.removeInteraction(snap);
    
    vectorLayer.getSource().refresh()

}




async function loadPublics(publicCible){
    try {
        document.getElementById('popup').innerHTML = '';
        popup.getElement().style.display = 'none';

        vectorLayer.getSource().clear();

        processPublicCible(publicCible);

    } catch (error) {
        console.error('Une erreur s\'est produite :', error);
    }
   
}


async function processPublicCible(publicCible) {
    try {
        var serviceIds = await getAllServicesFromPublic(publicCible);
        console.log("IDs des services obtenus :", serviceIds);

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

        const filteredServices = features.filter(feature => feature.properties.public_cible.includes(publicCible));

        const serviceIds = filteredServices.map(service => service.id);

        console.log('IDs des services pour le public cible ' + publicCible + ' :', serviceIds);

        return serviceIds;

    } catch (error) {
        console.error('Une erreur s\'est produite lors du chargement des services :', error);
    }
}


async function modifyFeature(feature) {

    console.log("WEEEEESH" + JSON.stringify(feature.getGeometry().getCoordinates()));
    const coord = feature.getGeometry().getCoordinates();

    console.log("1 : " + coord[0]);
    console.log("2 : " + coord[1]);
    console.log("3 : " + feature.getId());
    

    const transactionXML = `
    <Transaction xmlns="http://www.opengis.net/wfs" service="WFS" version="1.1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
    <Update typeName="feature:batiments" xmlns:feature="projet">
        <Property>
            <Name>geometrie</Name>
            <Value>
                <Point xmlns="http://www.opengis.net/gml" srsName="EPSG:4326">
                    <pos srsDimension="2">${coord[0]} ${coord[1]}</pos>
                </Point>
            </Value>
        </Property>
        <Filter xmlns="http://www.opengis.net/ogc">
            <FeatureId fid="${feature.getId()}"/>
        </Filter>
    </Update>
</Transaction>
`;

try {
    const response = await fetch('http://localhost:8080/geoserver/projet/wfs', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'text/xml',
        },
        body: transactionXML,
    });
    console.log('Transaction WFS exécutée avec succès.');
    resetBatiments();

    } catch (error) {
        console.error('Erreur lors de la requête WFS Transaction:', error);
    }
}
 
async function creerUnBatiment(latitude,longitude,composante,nom,campus,cp,rue) {
    const transactionXML = `
        <wfs:Transaction service="WFS" version="1.0.0"
            xmlns:wfs="http://www.opengis.net/wfs"
            xmlns:projet="projet"
            xmlns:gml="http://www.opengis.net/gml"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/WFS-transaction.xsd projet http://localhost:8080/geoserver/wfs/DescribeFeatureType?typename=projet:batiments">
            <wfs:Insert>
                <projet:batiments>
                    <projet:the_geom>
                        <gml:Point srsName="http://www.opengis.net/gml/srs/epsg.xml#3857">
                            <gml:coordinates decimal="." cs="," ts=" ">
                                `+latitude+`,`+longitude+`
                            </gml:coordinates>
                        </gml:Point>
                    </projet:the_geom>
                    <projet:composante>`+composante+`</projet:composante>
                    <projet:nom>`+nom+`</projet:nom>
                    <projet:campus>`+campus+`</projet:campus>
                    <projet:cp>`+cp+`</projet:cp>
                    <projet:rue>`+rue+`</projet:rue>
                    <projet:coordonnees_lat>`+latitude+`</projet:coordonnees_lat>
                    <projet:coordonnees_lon>`+longitude+`</projet:coordonnees_lon>
                    <projet:geometrie>
                        <gml:Point srsName="http://www.opengis.net/gml/srs/epsg.xml#3857">
                            <gml:coordinates decimal="." cs="," ts=" ">
                                `+latitude+`,`+longitude+`
                            </gml:coordinates>
                        </gml:Point>
                    </projet:geometrie>
                </projet:batiments>
            </wfs:Insert>
        </wfs:Transaction>
    `;

    try {
        const response = await fetch('http://localhost:8080/geoserver/projet/wfs', {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/xml',
            },
            body: transactionXML,
        });
        console.log('Transaction WFS exécutée avec succès.');

    } catch (error) {
        console.error('Erreur lors de la requête WFS Transaction:', error);
    }
}

createButtons();


