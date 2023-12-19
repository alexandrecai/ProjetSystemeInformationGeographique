import 'ol/ol.css';
import {GeoJSON, WFS} from "ol/format";
import * as filter from "ol/format/filter";
import * as turf from '@turf/helpers';


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
        const serviceNames = features.map(feature => [feature.id, feature.properties.nom_service, feature.properties.description_service]);


        return serviceNames;
    } catch (error) {
        console.error('Une erreur s\'est produite lors du chargement des services :', error);
    }
}

async function loadServices(serviceId) {
    try {
        var features = await requeteFilter('batiment_service', 'service_id', serviceId.replace('services.', ''));
        for (let i = 0; i < features.length; i++) {
            var batimentId = features[i].getProperties().batiment_id;
            var featureBatiment = await requeteId('batiments', batimentId);
            featureBatiment.forEach(feature => {
                feature.getGeometry().transform('EPSG:4326', 'EPSG:3857');
            });
            return [featureBatiment[0].values_.coordonnees_lat, featureBatiment[0].values_.coordonnees_lon];
        }

    } catch (error) {
        // Gérez les erreurs
        console.error('Une erreur s\'est produite :', error);
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

// Récupérez les références des boutons
var csvButton = document.getElementById('csv');
var geojsonButton = document.getElementById('geojson');

// Ajoutez des écouteurs d'événements pour les clics sur les boutons
csvButton.addEventListener('click', function() {
writeFile('csv');
});

geojsonButton.addEventListener('click', function() {
writeFile('geojson');
});

async function writeFile(outputFormat){

    // récupération des services
    var services = await getAllServices();
    var enhancedServices = [];
    for (let i = 0; i < services.length; i++) {
        var coordonnes = await loadServices(services[i][0]);
        enhancedServices.push({
            "name": services[i][1],
            "description": services[i][2],
            "coordonnees": coordonnes
        });
    }
    

    // Pour chaque services, on récupère les coordonnées associées

    if (outputFormat == 'csv'){
        writeCSV(enhancedServices);
    }
    if (outputFormat == 'geojson'){
        writeGeoJSON(enhancedServices);
    }
}

function writeCSV(services){
    // Données CSV (remplacez cela par vos propres données)
    var csvData = [
        ["name", "description", "coordonnees_lat", "coordonnees_lon"],
    ];

    for (let i = 0; i < services.length; i++){
        csvData.push([services[i].name, services[i].description, services[i].coordonnees[0], services[i].coordonnees[1]]);
    }

    console.log(csvData);

    // Convertir les données en texte CSV
    const csvText = csvData.map(row => row.join(",")).join("\n");

    // Créer un objet blob
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });

    // Créer un lien d'ancrage pour télécharger le fichier CSV
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "campus.csv");

    // Ajouter le lien à la page et cliquer dessus pour déclencher le téléchargement
    document.body.appendChild(link);
    link.click();

    // Supprimer le lien de la page une fois le téléchargement terminé
    document.body.removeChild(link);
}

function writeGeoJSON(services){
    var jsonArray = [];

    for (let i = 0; i < services.length; i++){
        jsonArray.push({
            type: 'Feature',
            geometry: turf.point([services[i].coordonnees[0], services[i].coordonnees[1]]),
            properties: {
              name: services[i].name,
              description: services[i].description,
            },
          });
    }

    const geojsonObject = {
        type: 'FeatureCollection',
        features: jsonArray,
    };

    const geojsonString = JSON.stringify(geojsonObject, null, 2);

    // Créer un objet Blob
    const blob = new Blob([geojsonString], { type: 'application/json' });
    
    // Créer un objet URL à partir du Blob
    const url = URL.createObjectURL(blob);
    
    // Créer un élément <a> pour le téléchargement
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campus.geojson';
    
    // Ajouter l'élément <a> au DOM et déclencher le téléchargement
    document.body.appendChild(a);
    a.click();
    
    // Retirer l'élément <a> du DOM
    document.body.removeChild(a);
    

}
