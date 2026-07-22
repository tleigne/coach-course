// Parsing KML / KMZ (exports Google Maps, Google Earth, My Maps) comme
// source de parcours alternative au GPX.
import { construireParcours } from './gpx.js';

function parserCoordonneesKML(texteCoordonnees) {
  return texteCoordonnees
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((triplet) => {
      const [lon, lat, ele] = triplet.split(',').map(Number);
      return { lat, lon, ele: isNaN(ele) ? 0 : ele };
    })
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lon));
}

/**
 * Parse le texte d'un fichier KML et retourne la description du parcours,
 * dans le même format que parserGPX. Basé sur une extraction par expression
 * régulière plutôt que sur querySelector, pour éviter les soucis d'espaces
 * de noms XML (ex. gx:coord) selon les exports.
 */
export function parserKML(texteXML) {
  if (!/<kml[\s>]/i.test(texteXML)) {
    throw new Error("Ce fichier n'est pas un KML valide.");
  }

  let brut = [];

  const blocsCoordonnees = Array.from(texteXML.matchAll(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi)).map(
    (m) => m[1]
  );
  for (const bloc of blocsCoordonnees) {
    brut = brut.concat(parserCoordonneesKML(bloc));
  }

  if (brut.length < 2) {
    // Format Google Earth "gx:track" : <gx:coord>lon lat alt</gx:coord>
    const blocsGx = Array.from(texteXML.matchAll(/<gx:coord>([\s\S]*?)<\/gx:coord>/gi)).map((m) => m[1]);
    for (const bloc of blocsGx) {
      const [lon, lat, ele] = bloc.trim().split(/\s+/).map(Number);
      if (!isNaN(lat) && !isNaN(lon)) brut.push({ lat, lon, ele: isNaN(ele) ? 0 : ele });
    }
  }

  if (brut.length < 2) {
    throw new Error('Ce fichier KML ne contient pas de tracé exploitable (aucune LineString trouvée).');
  }

  const matchNom = texteXML.match(/<name>([\s\S]*?)<\/name>/i);
  const nom = matchNom ? matchNom[1].replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim() : '';

  return construireParcours(nom, brut);
}

async function decompresserDeflate(octetsCompresses) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      "Ce navigateur ne sait pas décompresser les fichiers KMZ. Essaie d'extraire le fichier .kml toi-même (dans un gestionnaire de fichiers, renomme la copie du .kmz en .zip pour l'ouvrir) et importe-le directement."
    );
  }
  const flux = new Blob([octetsCompresses]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(flux).arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Extrait le texte du premier fichier .kml trouvé dans une archive KMZ
 * (un KMZ est un simple ZIP). Lit directement les en-têtes de fichiers
 * locaux du ZIP, sans bibliothèque externe.
 */
export async function extraireKMLDeKMZ(arrayBuffer) {
  const vue = new DataView(arrayBuffer);
  const octets = new Uint8Array(arrayBuffer);
  const decodeur = new TextDecoder('utf-8');

  const SIGNATURE_HEADER_LOCAL = 0x04034b50;
  let offset = 0;

  while (offset < octets.length - 30) {
    if (vue.getUint32(offset, true) !== SIGNATURE_HEADER_LOCAL) break;

    const methodeCompression = vue.getUint16(offset + 8, true);
    const tailleCompressee = vue.getUint32(offset + 18, true);
    const longueurNom = vue.getUint16(offset + 26, true);
    const longueurExtra = vue.getUint16(offset + 28, true);

    const debutNom = offset + 30;
    const nomFichier = decodeur.decode(octets.slice(debutNom, debutNom + longueurNom));
    const debutDonnees = debutNom + longueurNom + longueurExtra;
    const donneesCompressees = octets.slice(debutDonnees, debutDonnees + tailleCompressee);

    if (/\.kml$/i.test(nomFichier)) {
      if (methodeCompression === 0) {
        return decodeur.decode(donneesCompressees);
      }
      if (methodeCompression === 8) {
        const donnees = await decompresserDeflate(donneesCompressees);
        return new TextDecoder('utf-8').decode(donnees);
      }
      throw new Error('Format de compression KMZ non pris en charge.');
    }

    offset = debutDonnees + tailleCompressee;
  }

  throw new Error('Aucun fichier .kml trouvé dans cette archive KMZ.');
}
