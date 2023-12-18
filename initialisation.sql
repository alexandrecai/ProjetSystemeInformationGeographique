DROP TABLE IF EXISTS batiment_service;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS batiments;

CREATE TABLE batiments (
    Id SERIAL PRIMARY KEY,
    Composante VARCHAR(255),
    Nom VARCHAR(255),
    Campus VARCHAR(255),
    CP NUMERIC,
    Rue VARCHAR(255),
    Coordonnees_lat NUMERIC,
    Coordonnees_lon NUMERIC,
    Geometrie GEOGRAPHY(Point, 4326)
);

\COPY batiments(Composante, Nom, Campus, CP, Rue, Coordonnees_lat, Coordonnees_lon, Geometrie) FROM 'batiments.csv' WITH CSV HEADER;

UPDATE batiments SET Geometrie = ST_SetSRID(ST_MakePoint(Coordonnees_lon, Coordonnees_lat), 4326);

CREATE TABLE services (
    Id SERIAL PRIMARY KEY,
    Nom_service VARCHAR(255),
    Description_service TEXT,
    Public_cible VARCHAR(255)
);

\COPY services(Nom_service, Description_service, Public_cible) FROM 'services.csv' WITH CSV HEADER;

CREATE TABLE batiment_service (
    Id SERIAL PRIMARY KEY,
    Batiment_id INTEGER REFERENCES batiments(Id),
    Service_id INTEGER REFERENCES services(Id)
);

\COPY batiment_service(Batiment_id, Service_id) FROM 'batiment_service.csv' WITH CSV HEADER;
