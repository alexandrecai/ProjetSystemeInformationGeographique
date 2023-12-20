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


//Variable de classes qui servent à gérer le mode edit (création d'un point)
let drawing = false;
//Variables pour gérer le déplacement d'un point
let listenNextClic = false;
let featureUpdate;

let tileGeoData;
let centerGeoData;


//Permet de récupérer le nombre de batiment dans le but d'obtenir l'ID suivant (sert quand on créé des bâtiments pour lier un service)
async function getNombreBatiment() {
    // URL de la requête WFS
    var wfsUrl = 'http://localhost:8080/geoserver/projet/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=projet%3Abatiments&maxFeatures=150&outputFormat=application%2Fjson';

    try {
        // Utilisation de la fonction fetch pour effectuer la requête GET
        const response = await fetch(wfsUrl);

        // Vérifiez si la réponse est OK (statut 200)
        if (!response.ok) {
            throw new Error('La requête a échoué avec le statut : ' + response.status);
        }

        // Parsez le JSON
        const data = await response.json();
        return data.numberReturned;
    } catch (error) {
        // Gérez les erreurs ici
        console.error('Erreur lors de la récupération des données :', error);
        throw error; // Vous pouvez choisir de lancer à nouveau l'erreur ou de la traiter autrement
    }
}

// Permet de centrer le map sur Orélans / Bourges / Chateauroux selon l'onglet choisi
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

//Fond de map
const osm = new TileLayer({
    extent: proj.transformExtent(tileGeoData, 'EPSG:4326', 'EPSG:3857'),
    source: new OSM(),
});

//Ajout de la méthode sur le bouton de recherche
document.getElementById("rechercheBatiment").addEventListener("click", function() {
    const recherche = document.getElementById('nomRecherche').value;
    loadData('nom', recherche).then(r => {});
});


//Fonction pour la recherche
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

//Définition de la source de notre vecteur source : les bâtiments
const sourceLayer = new VectorSource({
    url: 'http://localhost:8080/geoserver/projet/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=projet%3Abatiments&maxFeatures=150&outputFormat=application%2Fjson',
    format: new format.GeoJSON(),
});

//Définition de notre vecteur source
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

//Définition de la map avec fond de map + vectorLayer
const map = new Map({
    target: 'map',
    layers: [osm, vectorLayer],
    view: new View({
        center: fromLonLat(centerGeoData),
        zoom: 17,
    }),
});

//Récupération du nombre de bâtiments (sert pour l'ajout de nouveaux bâtiments pour lier un service)
let nbBats = await getNombreBatiment();

//Permet la surbrillance d'un point
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

//Positionnement et ajout de notre bulle popup qui donne entre autre les détails d'un PI
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


//Ecoute des clics sur la map
map.on('singleclick', async event => {
    const feature = map.forEachFeatureAtPixel(event.pixel, feature => feature);

    //On rentre dans ce if si on est passé par le mode edit et qu'on ajoute une nouvelle feature qui n'a pas encore d'ID ni de paramètres
    if(feature && feature.id_ == undefined) {
      
        popup.setPosition(event.coordinate);
        popup.getElement().style.display = 'block';

        const popupElement = document.getElementById('popup');

        var completed = false;

        var services = await getAllServices();
    

        let optionsHTML = '';
            for (const [id, nom_service] of services) {
                optionsHTML += `<option value="${id}">${nom_service}</option>`;
            }

        //Formulaire de création du bâtiment
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

            <label for="serviceBatiment">Service:</label>
            <select id="serviceBatiment" name="serviceBatiment" required>
                ${optionsHTML}
            </select>

            <br>

            <button type="submit">Enregistrer</button>
        </form>
        `;


        popupElement.innerHTML = formulaireHTML;
    
        const idBat = Date.now();
        feature.setId("batiments."+ idBat);
        

        const coordonnees = event.coordinate;

        const formulaireBatiment = document.getElementById('formulaireBatiment');
        formulaireBatiment.addEventListener('submit', async function (event) {
            event.preventDefault();
            const nomBatiment = document.getElementById('nomBatiment').value;
            const composanteBatiment = document.getElementById('composanteBatiment').value;
            const rueBatiment = document.getElementById('rueBatiment').value;
            const cpBatiment = document.getElementById('cpBatiment').value;
            const idService = document.getElementById('serviceBatiment').value;
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

            const batCree = await creerUnBatiment(coordonnees[0],coordonnees[1],composanteBatiment,nomBatiment,campus,cpBatiment,rueBatiment);
            //Création succès
            if (batCree) {
                //Lier le bâtiment au service choisi
                await ajouterServiceBat(++nbBats, idService.replace('services.',''));
            }
            
        });

        //Création échec, on clean le layer
        if (!completed) {
            vectorLayer.getSource().removeFeature(feature);
            vectorLayer.getSource().changed();
        }

    }
    //On rentre dans ce if si on clique sur un PI et qu'il a un ID (= pas un nouvea PI, un PI existant)
    else if (feature && feature.id_ != undefined) {

        const properties = feature.getProperties();
        popup.setPosition(event.coordinate);
        document.getElementById('popup').innerHTML = '<p class="title-batiment">' + properties.nom + ' - ' + properties.composante;
        popup.getElement().style.display = 'block';

       
        let id = feature.id_.replace('batiments.','');

        //On récupère les informations de ce PI et on les affiche, y compris tous les services liés
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
                console.error('Une erreur s\'est produite :', error);
            });

       
    } 
    //On rentre dans ce if si on a cliqué sur un espace libre et de la carte et qu'on est en mode écoute avec le boolean listenNextClic à true
    else if(listenNextClic) {

        //Récupération des coordonnées là où on a cliqué
        const coordonneesLonLat = proj.toLonLat(event.coordinate, 'EPSG:3857');
        //Modification des coordonnées du point
        featureUpdate.getGeometry().setCoordinates(coordonneesLonLat);
        modifyFeature(featureUpdate);
        listenNextClic = false;
    
    }
    
    //On a cliqué sur un espace vide sans rien faire d'autre, on efface la popup
    else {
        document.getElementById('popup').innerHTML = '';
        popup.getElement().style.display = 'none';
    }
});

//Servent à l'ajout d'un nouveau point
let draw, snap;
let modify = new Modify({source: sourceLayer});

//Permet de passer en mode dessin
function addInteractions() {

    map.addInteraction(modify);

    console.log("Mode dessin ON");
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

//Permet de retirer le mode dessin
function removeInteractions() {
    console.log("Mode dessin OFF");
    drawing = false;
    document.getElementById("buttonDrawing").style.backgroundColor = '';
    
    map.removeInteraction(modify);
    map.removeInteraction(draw);
    map.removeInteraction(snap);

    document.getElementById('popup').innerHTML = '';
    popup.getElement().style.display = 'none';

}

//Ajout du bouton pour dessiner (edit)
const button = document.createElement('button');
button.id="buttonDrawing";
button.textContent = "Edit";
button.addEventListener('click', () => { if (!drawing) {addInteractions()} else { removeInteractions()} });


document.getElementById('nav').appendChild(button);


//Fonction qui permet de récupérer une feature selon le filtre donné
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


//Fonction qui permet de récupérer une feature par son ID
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

//Fonction qui permet de récupérer une ou plusieurs features selon un filtre
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
    return url;
}


//Retourne une liste avec tous les publics mais que 1 fois
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

//Fonction de création des boutons pour permettre un filtre selon les services / On lit dynamiquement les services disponibles et on génère les boutons en fonction
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

//Fonction de récupération de tous les services
async function getAllServices() {
    try {
        const response = await fetch('http://localhost:8080/geoserver/projet/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=projet:services&outputFormat=application/json');

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const features = data.features;

        const serviceNames = features.map(feature => [feature.id, feature.properties.nom_service]);

        return serviceNames;
    } catch (error) {
        console.error('Une erreur s\'est produite lors du chargement des services :', error);
    }
}

//Fonction pour récupérer les services correspondant aux publics
async function getAllPublics() {
    try {
        const response = await fetch('http://localhost:8080/geoserver/projet/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=projet:services&outputFormat=application/json');

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const features = data.features;

        const serviceNames = features.map(feature => [feature.id, feature.properties.public_cible]);
     

        return serviceNames;
    } catch (error) {
        console.error('Une erreur s\'est produite lors du chargement des services :', error);
    }
}

//Sert pour la recherche avec filtre
async function loadServices(serviceId) {
    try {
        document.getElementById('popup').innerHTML = '';
        popup.getElement().style.display = 'none';
        vectorLayer.getSource().clear();
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

//Permet de reset le layer et de supprimer les filtres existants sur la map
function resetBatiments() {
    
    document.getElementById('popup').innerHTML = '';
    popup.getElement().style.display = 'none';

    document.getElementById('nomRecherche').value = '';

    map.removeInteraction(modify);
    map.removeInteraction(draw);
    map.removeInteraction(snap);
    
    vectorLayer.getSource().refresh()

}

//Fonction de chargement des publics cibles
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

//Fonction de process des publics cibles
async function processPublicCible(publicCible) {
    try {
        var serviceIds = await getAllServicesFromPublic(publicCible);

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
        console.error('Une erreur s\'est produite :', error);
    }
}

//Fonction pour récupérer tous les services liés à un public cible donné
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

        return serviceIds;

    } catch (error) {
        console.error('Une erreur s\'est produite lors du chargement des services :', error);
    }
}


//Fonction de modification d'une feature (bâtiments)
async function modifyFeature(feature) {

    const coord = feature.getGeometry().getCoordinates();

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

//Fonction d'ajout de la liaison bâtiment-service
async function ajouterServiceBat(idBat, idService){
    const transactionXML = `
            <wfs:Transaction service="WFS" version="1.0.0"
            xmlns:wfs="http://www.opengis.net/wfs"
            xmlns:projet="projet"
            xmlns:gml="http://www.opengis.net/gml"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/WFS-transaction.xsd projet http://localhost:8080/geoserver/wfs/DescribeFeatureType?typename=projet:batiment_service">
            <wfs:Insert>
                <projet:batiment_service>
                <projet:batiment_id>${idBat}</projet:batiment_id>
                <projet:service_id>${idService}</projet:service_id>
                </projet:batiment_service>
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

//Fonction de création d'un bâtiment
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
        return true;
    

    } catch (error) {
        console.error('Erreur lors de la requête WFS Transaction:', error);
        return false;
    }
}


//Appel de la création des boutons
createButtons();


