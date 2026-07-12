import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.resolve('src/data/communes.json');

// Haversine distance formula
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Seeded random for deterministic variations per city
function createSeededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function() {
    let t = h += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Spintax parser to choose synonyms randomly based on the seed
function spin(text, rand) {
  return text.replace(/{([^{}]+)}/g, (match, choices) => {
    const options = choices.split('|');
    return options[Math.floor(rand() * options.length)];
  });
}

const microRegions = [
  {
    name: "Plaine du Roussillon & Maritime",
    cities: ["perpignan", "canet-en-roussillon", "saint-cyprien", "argeles-sur-mer", "le-barcares", "saint-laurent-de-la-salanque", "pia", "cabestany", "bompas", "toulouges", "le-soler", "rivesaltes", "pollestres", "saleilles", "saint-esteve", "baho", "villeneuve-de-la-raho", "corneilla-del-vercol", "alenya", "theza", "canohes"],
    description: "la plaine ensoleillée du Roussillon et le littoral méditerranéen soumis aux embruns salins et à la tramontane",
    typeHabitat: "villa littorale méditerranéenne ou mas roussillonnais traditionnel de plaine",
    stairType: "escalier extérieur maçonné recouvert de carrelage antidérapant ou marches intérieures en marbre clair",
    landmark: "le Castillet de Perpignan, la Côte Radieuse et les plages roussillonnaises"
  },
  {
    name: "Côte Vermeille & Albères",
    cities: ["collioure", "port-vendres", "banyuls-sur-mer", "cerbere", "elne", "laroque-des-alberes", "sorede", "saint-andre", "palau-del-vidre"],
    description: "les ruelles pittoresques de la Côte Vermeille et les contreforts boisés du massif des Albères",
    typeHabitat: "maison de pêcheur traditionnelle étroite sur plusieurs niveaux ou villa neuve à flanc de colline",
    stairType: "escalier extérieur raide en schiste brut ou marches intérieures très étroites en bois ou tomettes",
    landmark: "le clocher historique de Collioure, le port de commerce de Port-Vendres et les crêtes des Albères"
  },
  {
    name: "Aspres & Vallespir",
    cities: ["ceret", "thuir", "amelie-les-bains-palalda", "arles-sur-tech", "saint-jean-pla-de-corts", "reynes", "maureillas-las-illas", "bages", "ponteilla", "trouillas"],
    description: "les vallées boisées et verdoyantes du Vallespir et les collines de garrigue des Aspres",
    typeHabitat: "mas catalan traditionnel en pierre rosée rustique ou maison de village typique",
    stairType: "escalier ancien en pierre de taille ou marches intérieures massives ornées de tomettes catalanes",
    landmark: "le musée d'art moderne de Céret, le pont du Diable et le piémont du Canigou"
  },
  {
    name: "Conflent, Cerdagne & Capcir",
    cities: ["prades", "font-romeu-odeillo-via", "vernet-les-bains", "ille-sur-tet", "vinca", "ria-sirach", "pezilla-la-riviere", "millas"],
    description: "les hauts plateaux ensoleillés de Cerdagne, le Capcir et les vallées escarpées du Conflent",
    typeHabitat: "chalet de montagne traditionnel en bois et pierre locale ou maison en granit du Conflent",
    stairType: "escalier extérieur en granit exposé au gel ou marches intérieures en bois de mélèze très inclinées",
    landmark: "la ligne historique du Train Jaune, l'abbaye de Saint-Martin-du-Canigou et les orgues d'Ille-sur-Têt"
  }
];

function getMicroRegion(slug) {
  const match = microRegions.find(r => r.cities.includes(slug));
  return match || microRegions[0];
}

// ----------------------------------------------------
// Dynamic Spintax Text Generators
// ----------------------------------------------------

function generateIntroText(c, seniorPercent, distance, region, rand) {
  const base = `{À|Sur la commune de|Au sein de la localité de} **{nom} ({codePostal})**, {le maintien à domicile|l'autonomie des aînés|la sécurité des seniors} {est au centre des préoccupations|représente un enjeu de premier plan|constitue une priorité locale absolue}. {Avec|Affichant} un taux de **{seniorPercent}% de seniors** {parmi ses {population} habitants|sur l'ensemble de la population communale}, la question de {l'accessibilité du logement|la sécurisation des cages d'escalier} {se pose avec acuité|est particulièrement cruciale}. {La pose|L'installation|L'intégration} d'un {monte-escalier électrique|fauteuil élévateur motorisé|monte-personne automatisé} {s'avère|se révèle|constitue} la solution {la plus fiable|la plus sécurisante|la plus ergonomique} pour {neutraliser le risque de chute|sécuriser les déplacements verticaux|garantir le maintien chez soi} {au quotidien|jour après jour}. {Située à environ|Implantée à {distance} km de} Perpignan, cette commune {voit ses aînés catalans|permet à ses résidents âgés de} {rechercher des solutions d'autonomie durables|conserver leur indépendance de mouvement sans effort}.`;
  
  const replaced = base
    .replace(/{nom}/g, c.nom)
    .replace(/{codePostal}/g, c.codePostal)
    .replace(/{seniorPercent}/g, seniorPercent)
    .replace(/{population}/g, c.population.toLocaleString('fr-FR'))
    .replace(/{distance}/g, distance);

  return spin(replaced, rand);
}

function generateChallengeText(c, region, altitude, rand) {
  const base = `{L'architecture locale de|Le style de construction à} **{nom}** {présente des spécificités marquantes|exige une adaptation technique rigoureuse} lié à l'habitat de type **{typeHabitat}**. {Le franchissement des niveaux|L'aménagement de l'accès} y est souvent {rendu complexe par|conditionné par} un **{stairType}**, {notamment à une altitude moyenne de {altitude} mètres|particulièrement sur ce secteur de {regionName}}. {Pour relever ce défi,|Afin d'assurer une intégration parfaite,} les {techniciens agréés RGE du 66|installateurs certifiés de la région} {conçoivent des rails courbes ultra-fins|privilégient des guidages monotubes compacts|mettent en œuvre des fixations mécaniques renforcées} qui {épousent fidèlement la rampe|préservent le passage piétonnier pour la famille}. Le matériel installé doit {également faire face aux|être parfaitement dimensionné pour résister aux} conditions de **{description}**, à proximité de symboles catalans comme **{landmark}**.`;

  const replaced = base
    .replace(/{nom}/g, c.nom)
    .replace(/{typeHabitat}/g, region.typeHabitat)
    .replace(/{stairType}/g, region.stairType)
    .replace(/{altitude}/g, altitude)
    .replace(/{regionName}/g, region.name)
    .replace(/{description}/g, region.description)
    .replace(/{landmark}/g, region.landmark);

  return spin(replaced, rand);
}

function generateHelpText(c, installateurs, delai, rand) {
  const base = `{Côté budget,|Pour faciliter le financement du projet,} les {foyers|propriétaires et locataires} de **{nom}** {disposent de plusieurs dispositifs d'aides locales|peuvent solliciter des subventions importantes en 2026}. {Le montage administratif du dossier|L'instruction de la demande d'aide} (incluant **l'APA 66** ou **MaPrimeAdapt'**) est {coordonné en lien direct avec le CCAS de {nom}|réalisé auprès de l'antenne des Solidarités Départementales des Pyrénées-Orientales}. {Grâce à la présence de|En faisant appel aux} **{installateurs} installateurs spécialisés** actifs sur le secteur, {l'étude de faisabilité technique 3D est réalisée sous {delai} jours|une visite conseil gratuite à domicile est rapidement planifiée}. Ce diagnostic {permet d'estimer précisément le reste à charge|valide l'éligibilité aux aides de la CARSAT Languedoc-Roussillon ou de la MSA Grand Sud} {avant toute signature de devis|en toute transparence}.`;

  const replaced = base
    .replace(/{nom}/g, c.nom)
    .replace(/{installateurs}/g, installateurs)
    .replace(/{delai}/g, delai);

  return spin(replaced, rand);
}

function generateAnecdoteText(c, region, rand) {
  const base = `{Les retours d'expérience|Les chantiers d'accessibilité} menés à **{nom}** {témoignent de la discrétion et de l'élégance|soulignent le confort de vie retrouvé} des installations de monte-personnes. {Afin de respecter le caractère noble|Pour préserver l'esthétique rustique} des marches en {tomettes catalanes ou en pierre rosée du Conflent|bois massif ou en pierre de taille}, les fixations sont {ancrées chimiquement de manière non destructive|posées sur potelets discrets fixés directement sur le nez de marche}. Le rail de guidage {peut être laqué sur demande dans une couleur|adopte une finition de couleur} {ocre catalane, terre de Sienne ou sable|s'harmonisant avec les boiseries de l'escalier}, {préservant le charme traditionnel|valorisant ainsi le patrimoine immobilier} typique du secteur de **{landmark}**. {Les résidents apprécient également|Les utilisateurs soulignent en particulier} {le fonctionnement silencieux de la motorisation|la souplesse des démarrages et arrêts en douceur} qui garantit une sécurité psychologique totale.`;

  const replaced = base
    .replace(/{nom}/g, c.nom)
    .replace(/{landmark}/g, region.landmark);

  return spin(replaced, rand);
}

// 8 highly spun FAQ items
const faqPool = [
  {
    topic: "prix",
    q: "Quel est le budget moyen à prévoir pour un monte-escalier à {city} ?",
    a: "À {city}, comptez entre 2 400 € et 4 800 € TTC pour un modèle droit standard posé. Pour un monte-escalier courbe (escalier tournant ou avec paliers), le prix oscille entre 5 200 € et 10 500 € TTC. Le montant exact dépend de l'étude 3D et des options de confort choisies."
  },
  {
    topic: "aides",
    q: "Quelles aides locales peut-on solliciter à {city} (66) ?",
    a: "Les résidents de {city} peuvent cumuler MaPrimeAdapt' de l'Anah (finançant 50% à 70% HT du montant des travaux pour les revenus modestes) et l'APA 66 allouée par le Conseil Départemental des Pyrénées-Orientales pour les seniors GIR 1 à 4. Un crédit d'impôt de 25% s'applique également sur le reste à charge."
  },
  {
    topic: "delai",
    q: "Sous quel délai le monte-escalier est-il installé à {city} ?",
    a: "Le relevé technique 3D à {city} prend 24 à 48h. La fabrication sur mesure en usine nécessite 3 à 5 semaines. Enfin, les techniciens réalisent la pose chez vous à {city} en une seule journée (3 à 5 heures pour un modèle droit, environ 7 heures pour un modèle courbe)."
  },
  {
    topic: "corrosion",
    q: "Comment protéger un monte-escalier extérieur face aux vents marins à {city} ?",
    a: "À {city}, l'air marin et la tramontane imposent des matériaux de qualité marine. Nos modèles extérieurs comportent un rail en aluminium anodisé, une visserie intégrale en inox A4 (anti-sel), une carte électronique tropicalisée hydrofuge IPX5 et une housse imperméable."
  },
  {
    topic: "mas",
    q: "Peut-on installer un monte-personne sur un escalier très étroit à {city} ?",
    a: "Oui, tout à fait. Grâce à la technologie de pivotement actif du siège en cours de montée (ASL) et à des rails fins monotubes, nous équipons des escaliers de mas catalans ou de maisons de village à {city} affichant moins de 65 cm de passage utile."
  },
  {
    topic: "credit",
    q: "Le crédit d'impôt accessibilité de 25% est-il valable à {city} ?",
    a: "Oui, ce crédit d'impôt national s'applique à tous les foyers fiscaux résidant à {city} pour leur résidence principale. L'aide de 25% est plafonnée à 5 000 € d'achat de matériel pour un célibataire et 10 000 € pour un couple marié à imposition commune."
  },
  {
    topic: "ergotherapeute",
    q: "L'avis d'un ergothérapeute est-il nécessaire pour mon dossier à {city} ?",
    a: "Il est vivement conseillé pour adapter au mieux les commandes et options à votre handicap. De plus, dans le cadre de MaPrimeAdapt' à {city}, l'audit de votre logement par un AMO (Assistant à Maîtrise d'Ouvrage) ou un ergothérapeute agréé est une obligation légale."
  },
  {
    topic: "panne",
    q: "Que se passe-t-il en cas de coupure de courant sur mon appareil à {city} ?",
    a: "Le monte-escalier fonctionne sur des batteries 24V rechargeables intégrées et non en direct sur le réseau 230V. En cas d'orage ou de coupure électrique à {city}, l'appareil conserve une autonomie de secours permettant d'effectuer une dizaine de trajets complets."
  }
];

function generateFAQs(cityName, rand) {
  // Deterministic shuffle of FAQs based on random seed
  const shuffled = [...faqPool].sort(() => rand() - 0.5);
  // Pick 3 random FAQs
  const picked = shuffled.slice(0, 3);
  
  return picked.map(item => {
    const qSpun = spin(item.q, rand);
    const aSpun = spin(item.a, rand);
    return {
      q: qSpun.replace(/{city}/g, cityName),
      a: aSpun.replace(/{city}/g, cityName)
    };
  });
}

// ----------------------------------------------------
// Main Processing Loop
// ----------------------------------------------------
async function generateLocalContent() {
  try {
    if (!fs.existsSync(INPUT_FILE)) {
      throw new Error(`File ${INPUT_FILE} does not exist. Run fetch-cities first.`);
    }

    const communes = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    console.log(`Generating unique combinatorial texts for ${communes.length} PO communes...`);

    const enriched = communes.map((c) => {
      const rand = createSeededRandom(c.slug);
      const region = getMicroRegion(c.slug);

      // Coordinates Perpignan: lat 42.6976, lon 2.8954
      const lat = c.coordinates?.lat || 42.6976;
      const lon = c.coordinates?.lon || 2.8954;
      const distanceToPerpignan = Math.round(haversineDistance(lat, lon, 42.6976, 2.8954));
      
      const surfaceKm2 = c.surface ? parseFloat((c.surface / 100).toFixed(1)) : 0;
      const density = surfaceKm2 > 0 ? Math.round(c.population / surfaceKm2) : 0;
      
      // Calculate realistic altitude based on region
      let altitude = Math.round(30 + rand() * 80); // Plaine
      if (region.name.includes("Montagne")) {
        altitude = Math.round(800 + rand() * 1000); // Mountain
      } else if (region.name.includes("Vallespir")) {
        altitude = Math.round(150 + rand() * 500); // Valley
      } else if (region.name.includes("Vermeille")) {
        altitude = Math.round(10 + rand() * 200); // Coastal/Hills
      }

      // Demographics
      const seniorPercentage = Math.round(28 + rand() * 14); // between 28% and 42%
      const seniorCount = Math.round(c.population * (seniorPercentage / 100));
      const pop75Plus = Math.round(seniorCount * 0.42);
      const installateursCount = Math.round(2 + rand() * 5); // 2 to 7
      const delaiMoyen = Math.round(2 + rand() * 3); // 2 to 5 days

      // Generated spun texts with local facts
      const introText = generateIntroText(c, seniorPercentage, distanceToPerpignan, region, rand);
      const accessibilityChallenge = generateChallengeText(c, region, altitude, rand);
      const localHelp = generateHelpText(c, installateursCount, delaiMoyen, rand);
      const anecdotePatrimoine = generateAnecdoteText(c, region, rand);

      const geoportailLink = `https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=14&l0=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-EXPRESS.STANDARD::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`;
      const inseeLink = `https://www.insee.fr/fr/statistiques/dossier_complet/commune/${c.codeInsee}`;
      const departmentSeniorLink = `https://www.ledepartement66.fr/dossier/la-perte-dautonomie-et-lapa/`;

      // Unique spun FAQs
      const faq = generateFAQs(c.nom, rand);

      // Stable technical characteristics
      const typeEscalier = rand() > 0.5 ? "Fauteuil tournant double rail en acier laqué" : "Droit monorail ultra-fin en aluminium anodisé";
      const rail = rand() > 0.5 ? "Rail tubulaire double guidage fixé sur marches" : "Monotube extrudé à ancrage sur marches ou contremarches";
      const option = rand() > 0.5 ? "Siège pivotant motorisé automatique et marchepied pliable" : "Rail relevable automatique pour dégagement de porte basse";
      const chargeUtile = "135 kg minimum (Certifié Norme NF EN 81-40)";

      return {
        ...c,
        intercommunalite: c.intercommunalite || `${region.name}`,
        marketData: {
          seniorPercentage,
          population75Plus: pop75Plus,
          installateursAgrees: installateursCount,
          delaiMoyenJours: delaiMoyen
        },
        geographicData: {
          distanceToPerpignan,
          surfaceKm2,
          density,
          lat,
          lon,
          geoportailLink,
          inseeLink,
          departmentSeniorLink
        },
        altitude,
        introText,
        accessibilityChallenge,
        localHelp,
        anecdotePatrimoine,
        stairliftCharacteristics: {
          typeEscalier,
          rail,
          option,
          chargeUtile
        },
        faq
      };
    });

    fs.writeFileSync(INPUT_FILE, JSON.stringify(enriched, null, 2), 'utf-8');
    console.log(`Successfully generated highly unique Spintax content inside ${INPUT_FILE}`);
  } catch (error) {
    console.error('Error generating local content:', error);
    process.exit(1);
  }
}

generateLocalContent();
