DROP TABLE batiments;

CREATE TABLE batiments (
    Composante VARCHAR(255),
    Nom VARCHAR(255),
    Campus VARCHAR(255),
    CP NUMERIC,
    Rue VARCHAR(255),
    Coordonnees_lat NUMERIC,
    Coordonnees_lon NUMERIC,
    Geometrie GEOGRAPHY(Point, 4326)
);

\COPY batiments FROM 'batiments.csv' WITH CSV HEADER;

UPDATE batiments SET Geometrie = ST_SetSRID(ST_MakePoint(Coordonnees_lon, Coordonnees_lat), 4326);