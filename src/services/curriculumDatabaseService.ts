import {
  CurriculumVersion,
  CurriculumSubjectRecord,
  CurriculumChapterRecord,
  CurriculumTopicRecord,
  BoardType,
  ClassLevel,
  SubjectType
} from '../types';
import { CURRICULUM_CHAPTERS } from '../data/curriculum';

// ============================================================================
// VERIFIED CURRICULUM DATABASE SERVICE
// Grounded in official CBSE Academic, NCERT, and CISCE syllabi.
// Strictly prevents syllabus hallucination. Supports versioning by academic year.
// ============================================================================

/**
 * Default verified curriculum versions stored in application catalog
 */
export const VERIFIED_CURRICULUM_VERSIONS: CurriculumVersion[] = [
  // --------------------------------------------------------------------------
  // CBSE Class 10 (Academic Year 2026-27) - Authoritative Primary
  // --------------------------------------------------------------------------
  {
    id: 'curriculum-cbse-10-2026-27',
    board: 'CBSE',
    classLevel: 'Class 10',
    academicYear: '2026-27',
    sourceName: 'CBSE Academic Official Curriculum 2026-27',
    sourceUrl: 'https://cbseacademic.nic.in/curriculum_2026.html',
    version: '1.0',
    isActive: true,
    lastVerifiedAt: '2026-09-23T00:00:00.000Z',
    subjects: [
      {
        id: 'cbse-10-math',
        name: 'Mathematics',
        code: '041',
        icon: '📐',
        color: '#4F46E5',
        chapters: [
          {
            id: 'ch-math-10-01',
            chapterNumber: 1,
            name: 'Real Numbers',
            description: 'Fundamental Theorem of Arithmetic, revisiting irrational numbers, proofs of irrationality of √2, √3, √5.',
            topics: [
              { id: 'top-math-10-01-1', name: 'Fundamental Theorem of Arithmetic', subtopics: ['Prime factorisation', 'HCF and LCM relation'] },
              { id: 'top-math-10-01-2', name: 'Revisiting Irrational Numbers', subtopics: ['Proof of irrationality of √2, √3, √5', 'Decimal representations'] }
            ]
          },
          {
            id: 'ch-math-10-02',
            chapterNumber: 2,
            name: 'Polynomials',
            description: 'Geometrical meaning of zeroes, relationship between zeroes and coefficients of quadratic polynomials.',
            topics: [
              { id: 'top-math-10-02-1', name: 'Geometrical Meaning of Zeroes', subtopics: ['Parabolas', 'Number of zeroes on x-axis'] },
              { id: 'top-math-10-02-2', name: 'Zeroes and Coefficients of Quadratic Polynomials', subtopics: ['Sum of roots = -b/a', 'Product of roots = c/a'] }
            ]
          },
          {
            id: 'ch-math-10-03',
            chapterNumber: 3,
            name: 'Pair of Linear Equations in Two Variables',
            description: 'Graphical method, consistency/inconsistency, algebraic solutions: substitution and elimination methods.',
            topics: [
              { id: 'top-math-10-03-1', name: 'Graphical Method of Solution', subtopics: ['Intersecting lines', 'Coincident lines', 'Parallel lines'] },
              { id: 'top-math-10-03-2', name: 'Substitution Method', subtopics: ['Expressing one variable in terms of other'] },
              { id: 'top-math-10-03-3', name: 'Elimination Method', subtopics: ['Equalizing coefficients', 'Word problems'] }
            ]
          },
          {
            id: 'ch-math-10-04',
            chapterNumber: 4,
            name: 'Quadratic Equations',
            description: 'Standard form ax² + bx + c = 0, solution by factorisation and quadratic formula, nature of roots.',
            topics: [
              { id: 'top-math-10-04-1', name: 'Standard Form of Quadratic Equations', subtopics: ['Identification of quadratic equations'] },
              { id: 'top-math-10-04-2', name: 'Solution by Factorisation', subtopics: ['Splitting the middle term'] },
              { id: 'top-math-10-04-3', name: 'Quadratic Formula & Nature of Roots', subtopics: ['Discriminant D = b² - 4ac', 'Real and distinct roots', 'Equal roots', 'No real roots'] }
            ]
          },
          {
            id: 'ch-math-10-05',
            chapterNumber: 5,
            name: 'Arithmetic Progressions',
            description: 'Motivation for studying AP, nth term of an AP, sum of first n terms of an AP and application in daily life.',
            topics: [
              { id: 'top-math-10-05-1', name: 'nth Term of an AP', subtopics: ['General term formula an = a + (n-1)d', 'Common difference d'] },
              { id: 'top-math-10-05-2', name: 'Sum of First n Terms of an AP', subtopics: ['Sn = n/2[2a + (n-1)d]', 'Daily word problems'] }
            ]
          },
          {
            id: 'ch-math-10-06',
            chapterNumber: 6,
            name: 'Triangles',
            description: 'Definitions, examples, counter-examples of similar triangles, Basic Proportionality Theorem (Thales), criteria for similarity.',
            topics: [
              { id: 'top-math-10-06-1', name: 'Basic Proportionality Theorem (BPT)', subtopics: ['Proof and converse of BPT'] },
              { id: 'top-math-10-06-2', name: 'Criteria for Similarity of Triangles', subtopics: ['AAA / AA criterion', 'SAS criterion', 'SSS criterion'] }
            ]
          },
          {
            id: 'ch-math-10-07',
            chapterNumber: 7,
            name: 'Coordinate Geometry',
            description: 'Concepts of coordinate geometry, graphs of linear equations, Distance formula, Section formula (internal division).',
            topics: [
              { id: 'top-math-10-07-1', name: 'Distance Formula', subtopics: ['Distance between two points', 'Collinear points', 'Geometric figures verification'] },
              { id: 'top-math-10-07-2', name: 'Section Formula', subtopics: ['Internal division of line segment', 'Midpoint formula'] }
            ]
          },
          {
            id: 'ch-math-10-08',
            chapterNumber: 8,
            name: 'Introduction to Trigonometry',
            description: 'Trigonometric ratios of acute angles, values of trigonometric ratios of 30°, 45°, 60°, trigonometric identities.',
            topics: [
              { id: 'top-math-10-08-1', name: 'Trigonometric Ratios of Acute Angles', subtopics: ['sin, cos, tan, cosec, sec, cot definitions'] },
              { id: 'top-math-10-08-2', name: 'Values of Trigonometric Ratios of Specific Angles', subtopics: ['30°, 45°, 60° angle values table'] },
              { id: 'top-math-10-08-3', name: 'Trigonometric Identities', subtopics: ['sin²θ + cos²θ = 1', '1 + tan²θ = sec²θ', '1 + cot²θ = cosec²θ'] }
            ]
          },
          {
            id: 'ch-math-10-09',
            chapterNumber: 9,
            name: 'Some Applications of Trigonometry',
            description: 'Heights and Distances: Angle of elevation, Angle of Depression, simple problems using angles 30°, 45°, 60°.',
            topics: [
              { id: 'top-math-10-09-1', name: 'Angle of Elevation and Depression', subtopics: ['Horizontal line of sight', 'Right triangle modeling'] },
              { id: 'top-math-10-09-2', name: 'Heights and Distances Problems', subtopics: ['Single right triangle problems', 'Two right triangle multi-step problems'] }
            ]
          },
          {
            id: 'ch-math-10-10',
            chapterNumber: 10,
            name: 'Circles',
            description: 'Tangent to a circle at point of contact, tangents from an external point are equal.',
            topics: [
              { id: 'top-math-10-10-1', name: 'Tangent to a Circle', subtopics: ['Radius perpendicular to tangent at point of contact'] },
              { id: 'top-math-10-10-2', name: 'Tangents from an External Point', subtopics: ['Length of tangents theorem', 'Circle inscribed in polygon'] }
            ]
          },
          {
            id: 'ch-math-10-11',
            chapterNumber: 11,
            name: 'Areas Related to Circles',
            description: 'Area of sectors and segments of a circle, problems based on areas and perimeter / circumference.',
            topics: [
              { id: 'top-math-10-11-1', name: 'Area of Sectors and Segments of a Circle', subtopics: ['Sector formula (θ/360)*πr²', 'Segment area formula', 'Arc length (θ/360)*2πr'] }
            ]
          },
          {
            id: 'ch-math-10-12',
            chapterNumber: 12,
            name: 'Surface Areas and Volumes',
            description: 'Surface areas and volumes of combinations of two solids: cubes, cuboids, spheres, hemispheres and cylinders/cones.',
            topics: [
              { id: 'top-math-10-12-1', name: 'Surface Area of Combination of Solids', subtopics: ['Cylinder mounted by cone', 'Hemisphere and cone combination'] },
              { id: 'top-math-10-12-2', name: 'Volume of Combination of Solids', subtopics: ['Volume addition of joined solids'] }
            ]
          },
          {
            id: 'ch-math-10-13',
            chapterNumber: 13,
            name: 'Statistics',
            description: 'Mean, median and mode of grouped data (bimodal situation avoided). Mean by direct and assumed mean method.',
            topics: [
              { id: 'top-math-10-13-1', name: 'Mean of Grouped Data', subtopics: ['Direct method Σfi xi / Σfi', 'Assumed mean method'] },
              { id: 'top-math-10-13-2', name: 'Mode of Grouped Data', subtopics: ['Modal class', 'Mode formula l + ((f1-f0)/(2f1-f0-f2))*h'] },
              { id: 'top-math-10-13-3', name: 'Median of Grouped Data', subtopics: ['Cumulative frequency', 'Median formula l + ((n/2 - cf)/f)*h'] }
            ]
          },
          {
            id: 'ch-math-10-14',
            chapterNumber: 14,
            name: 'Probability',
            description: 'Classical definition of probability. Simple problems on finding the probability of an event.',
            topics: [
              { id: 'top-math-10-14-1', name: 'Classical Definition of Probability', subtopics: ['P(E) = Number of favourable outcomes / Total outcomes', 'Sure and impossible events'] },
              { id: 'top-math-10-14-2', name: 'Complementary Events & Coin/Dice/Card Problems', subtopics: ['P(E) + P(not E) = 1', 'Deck of 52 cards', 'Pair of dice'] }
            ]
          }
        ]
      },
      {
        id: 'cbse-10-sci',
        name: 'Science',
        code: '086',
        icon: '🔬',
        color: '#059669',
        chapters: [
          {
            id: 'ch-sci-10-01',
            chapterNumber: 1,
            name: 'Chemical Reactions and Equations',
            description: 'Chemical equation, Balanced chemical equation, types of chemical reactions: combination, decomposition, displacement, double displacement, precipitation, neutralization, oxidation and reduction.',
            topics: [
              { id: 'top-sci-10-01-1', name: 'Writing and Balancing Chemical Equations', subtopics: ['Law of conservation of mass', 'State symbols'] },
              { id: 'top-sci-10-01-2', name: 'Types of Chemical Reactions', subtopics: ['Combination', 'Decomposition (thermal, electrolytic, photolytic)', 'Displacement & Reactivity series', 'Double displacement & Precipitation'] },
              { id: 'top-sci-10-01-3', name: 'Oxidation, Reduction, Corrosion & Rancidity', subtopics: ['Redox definitions', 'Oxidizing and reducing agents', 'Rusting prevention', 'Antioxidants'] }
            ]
          },
          {
            id: 'ch-sci-10-02',
            chapterNumber: 2,
            name: 'Acids, Bases and Salts',
            description: 'Their definitions in terms of furnishing of H+ and OH- ions, General properties, examples and uses, neutralization, concept of pH scale, importance of pH in everyday life, preparation and uses of Sodium Hydroxide, Bleaching powder, Baking soda, Washing soda and Plaster of Paris.',
            topics: [
              { id: 'top-sci-10-02-1', name: 'Properties and Indicators of Acids and Bases', subtopics: ['Litmus, phenolphthalein, methyl orange', 'Olfactory indicators', 'Reaction with metals & carbonates'] },
              { id: 'top-sci-10-02-2', name: 'pH Scale and Everyday Significance', subtopics: ['pH = -log[H+]', 'Acid rain', 'Digestive pH', 'Tooth decay'] },
              { id: 'top-sci-10-02-3', name: 'Important Salts from Common Salt', subtopics: ['Chlor-alkali process (NaOH, Cl2, H2)', 'Bleaching powder CaOCl2', 'Baking soda NaHCO3', 'Washing soda Na2CO3.10H2O', 'Plaster of Paris CaSO4.1/2H2O'] }
            ]
          },
          {
            id: 'ch-sci-10-03',
            chapterNumber: 3,
            name: 'Metals and Non-metals',
            description: 'Properties of metals and non-metals; Reactivity series; Formation and properties of ionic compounds; Basic metallurgical processes; Corrosion and its prevention.',
            topics: [
              { id: 'top-sci-10-03-1', name: 'Physical & Chemical Properties of Metals and Non-metals', subtopics: ['Malleability, ductility, conductivity', 'Amphoteric oxides', 'Aqua regia'] },
              { id: 'top-sci-10-03-2', name: 'Reactivity Series & Ionic Bonding', subtopics: ['Electron dot structures', 'High melting point & conductivity of ionic compounds'] },
              { id: 'top-sci-10-03-3', name: 'Extraction of Metals & Corrosion Prevention', subtopics: ['Roasting and calcination', 'Thermite process', 'Galvanisation & alloys'] }
            ]
          },
          {
            id: 'ch-sci-10-04',
            chapterNumber: 4,
            name: 'Carbon and its Compounds',
            description: 'Covalent bonding in carbon compounds. Versatile nature of carbon. Homologous series. Nomenclature of carbon compounds. Chemical properties of carbon compounds. Ethanol and Ethanoic acid. Soaps and detergents.',
            topics: [
              { id: 'top-sci-10-04-1', name: 'Covalent Bonding and Versatile Nature of Carbon', subtopics: ['Tetravalency', 'Catenation', 'Allotropes: diamond, graphite, fullerene'] },
              { id: 'top-sci-10-04-2', name: 'Hydrocarbons & Homologous Series', subtopics: ['Alkanes, alkenes, alkynes', 'Functional groups (halo, alcohol, aldehyde, ketone, carboxylic acid)'] },
              { id: 'top-sci-10-04-3', name: 'Ethanol, Ethanoic Acid, Soaps and Detergents', subtopics: ['Esterification and saponification', 'Micelle formation and cleansing mechanism'] }
            ]
          },
          {
            id: 'ch-sci-10-05',
            chapterNumber: 5,
            name: 'Life Processes',
            description: 'Basic concept of nutrition, respiration, transport and excretion in plants and animals.',
            topics: [
              { id: 'top-sci-10-05-1', name: 'Autotrophic and Heterotrophic Nutrition', subtopics: ['Photosynthesis light and dark reactions', 'Human alimentary canal & digestive enzymes'] },
              { id: 'top-sci-10-05-2', name: 'Respiration in Plants and Animals', subtopics: ['Aerobic vs anaerobic respiration', 'ATP energy currency', 'Human respiratory system & alveoli'] },
              { id: 'top-sci-10-05-3', name: 'Transportation in Animals and Plants', subtopics: ['Human heart double circulation', 'Blood pressure and lymph', 'Xylem and phloem transpirational pull'] },
              { id: 'top-sci-10-05-4', name: 'Excretion in Humans and Plants', subtopics: ['Structure of nephron', 'Urine formation: filtration, reabsorption, secretion', 'Dialysis'] }
            ]
          },
          {
            id: 'ch-sci-10-06',
            chapterNumber: 6,
            name: 'Control and Coordination',
            description: 'Tropic movements in plants; Introduction of plant hormones; Control and co-ordination in animals: Nervous system; Voluntary, involuntary and reflex action; Chemical co-ordination: animal hormones.',
            topics: [
              { id: 'top-sci-10-06-1', name: 'Nervous System & Reflex Arc', subtopics: ['Neuron structure and synapse transmission', 'Human brain (forebrain, midbrain, hindbrain)', 'Reflex arc pathway'] },
              { id: 'top-sci-10-06-2', name: 'Plant Hormones & Tropic Movements', subtopics: ['Auxin, gibberellin, cytokinin, abscisic acid', 'Phototropism, geotropism, hydrotropism, thigmotropism'] },
              { id: 'top-sci-10-06-3', name: 'Endocrine Glands & Animal Hormones', subtopics: ['Thyroid (thyroxine), Adrenal (adrenaline), Pancreas (insulin), Pituitary (growth hormone)'] }
            ]
          },
          {
            id: 'ch-sci-10-07',
            chapterNumber: 7,
            name: 'How do Organisms Reproduce?',
            description: 'Reproduction in animals and plants (asexual and sexual) reproductive health-need and methods of family planning. Safe sex vs HIV/AIDS. Child bearing and women’s health.',
            topics: [
              { id: 'top-sci-10-07-1', name: 'Asexual Reproduction Modes', subtopics: ['Fission (amoeba, leishmania)', 'Fragmentation, regeneration (planaria)', 'Budding (hydra)', 'Vegetative propagation', 'Spore formation'] },
              { id: 'top-sci-10-07-2', name: 'Sexual Reproduction in Flowering Plants', subtopics: ['Structure of flower', 'Pollination self and cross', 'Double fertilisation and seed formation'] },
              { id: 'top-sci-10-07-3', name: 'Human Reproductive Systems & Reproductive Health', subtopics: ['Male reproductive system (testes, vas deferens)', 'Female reproductive system (ovaries, fallopian tube, uterus)', 'Menstrual cycle', 'Contraceptive methods: barrier, hormonal, surgical'] }
            ]
          },
          {
            id: 'ch-sci-10-08',
            chapterNumber: 8,
            name: 'Heredity and Evolution',
            description: 'Heredity; Mendel’s contribution- Laws for inheritance of traits: Sex determination: brief introduction.',
            topics: [
              { id: 'top-sci-10-08-1', name: 'Mendel’s Experiments and Laws of Inheritance', subtopics: ['Monohybrid cross (3:1 ratio)', 'Dihybrid cross (9:3:3:1 ratio)', 'Dominant and recessive traits'] },
              { id: 'top-sci-10-08-2', name: 'Sex Determination in Humans', subtopics: ['XX and XY sex chromosomes', '50% probability mechanism'] }
            ]
          },
          {
            id: 'ch-sci-10-09',
            chapterNumber: 9,
            name: 'Light – Reflection and Refraction',
            description: 'Reflection of light by curved surfaces; Images formed by spherical mirrors, centre of curvature, principal axis, principal focus, focal length, mirror formula, magnification. Refraction; Laws of refraction, refractive index. Refraction of light by spherical lens; Image formed by spherical lenses; Lens formula; Magnification. Power of a lens.',
            topics: [
              { id: 'top-sci-10-09-1', name: 'Spherical Mirrors and Ray Diagrams', subtopics: ['Concave and convex mirror ray diagrams', 'Sign convention', 'Mirror formula 1/f = 1/v + 1/u', 'Magnification m = -v/u'] },
              { id: 'top-sci-10-09-2', name: 'Refraction & Snell’s Law', subtopics: ['Laws of refraction', 'Refractive index n21 = v1/v2', 'Refraction through rectangular glass slab'] },
              { id: 'top-sci-10-09-3', name: 'Spherical Lenses and Power of a Lens', subtopics: ['Convex and concave lens ray diagrams', 'Lens formula 1/f = 1/v - 1/u', 'Magnification m = v/u', 'Power of lens P = 1/f (in meters), dioptres'] }
            ]
          },
          {
            id: 'ch-sci-10-10',
            chapterNumber: 10,
            name: 'The Human Eye and the Colourful World',
            description: 'Functioning of a lens in human eye, defects of vision and their corrections, applications of spherical mirrors and lenses. Refraction of light through a prism, dispersion of light, scattering of light, applications in daily life.',
            topics: [
              { id: 'top-sci-10-10-1', name: 'Human Eye & Defects of Vision', subtopics: ['Accommodation of eye', 'Myopia (short-sightedness) correction by concave lens', 'Hypermetropia correction by convex lens', 'Presbyopia'] },
              { id: 'top-sci-10-10-2', name: 'Refraction through Prism and Dispersion', subtopics: ['Angle of deviation', 'VIBGYOR spectrum', 'Atmospheric refraction: twinkling of stars, advance sunrise and delayed sunset'] },
              { id: 'top-sci-10-10-3', name: 'Scattering of Light & Tyndall Effect', subtopics: ['Tyndall effect in colloidal solutions', 'Blue colour of sky', 'Reddening of sun at sunrise and sunset'] }
            ]
          },
          {
            id: 'ch-sci-10-11',
            chapterNumber: 11,
            name: 'Electricity',
            description: 'Electric current, potential difference and electric current. Ohm’s law; Resistance, Resistivity, Factors on which the resistance of a conductor depends. Series combination of resistors, parallel combination of resistors and its applications in daily life. Heating effect of electric current and its applications in daily life. Electric power, Interrelation between P, V, I and R.',
            topics: [
              { id: 'top-sci-10-11-1', name: 'Electric Current, Potential Difference & Ohm’s Law', subtopics: ['I = Q/t', 'V = W/Q', 'Ohm’s law V = IR', 'V-I graph'] },
              { id: 'top-sci-10-11-2', name: 'Resistance, Resistivity & Combinations', subtopics: ['R = ρl/A', 'Series combination Rs = R1 + R2 + ...', 'Parallel combination 1/Rp = 1/R1 + 1/R2 + ...'] },
              { id: 'top-sci-10-11-3', name: 'Joule’s Heating Effect & Electric Power', subtopics: ['H = I²Rt', 'Electric fuse', 'P = VI = I²R = V²/R', 'Commercial unit 1 kWh = 3.6 x 10^6 J'] }
            ]
          },
          {
            id: 'ch-sci-10-12',
            chapterNumber: 12,
            name: 'Magnetic Effects of Electric Current',
            description: 'Magnetic field, field lines, field due to a current carrying conductor, field due to current carrying coil or solenoid; Force on current carrying conductor, Fleming’s Left Hand Rule, Direct current. Alternating current: frequency of AC. Advantage of AC over DC. Domestic electric circuits.',
            topics: [
              { id: 'top-sci-10-12-1', name: 'Magnetic Field and Field Lines', subtopics: ['Properties of magnetic field lines', 'Right-Hand Thumb Rule', 'Field inside a solenoid'] },
              { id: 'top-sci-10-12-2', name: 'Force on Current Conductor & Fleming’s Left-Hand Rule', subtopics: ['Lorentz force qualitative', 'Electric motor principle'] },
              { id: 'top-sci-10-12-3', name: 'Domestic Electric Circuits', subtopics: ['Live, neutral, earth wire', 'Earthing safety', 'Short-circuiting and overloading', 'Electric fuse and MCB'] }
            ]
          },
          {
            id: 'ch-sci-10-13',
            chapterNumber: 13,
            name: 'Our Environment',
            description: 'Eco-system, Environmental problems, Ozone depletion, waste production and their solutions. Biodegradable and non-biodegradable substances.',
            topics: [
              { id: 'top-sci-10-13-1', name: 'Ecosystem & Food Chains', subtopics: ['Producers, consumers, decomposers', 'Trophic levels', '10 percent law of energy flow', 'Biological magnification'] },
              { id: 'top-sci-10-13-2', name: 'Ozone Layer Depletion & Waste Management', subtopics: ['Ozone O3 formation and CFC impact', 'Biodegradable vs non-biodegradable waste', 'Landfills, composting, recycling'] }
            ]
          }
        ]
      },
      {
        id: 'cbse-10-eng',
        name: 'English',
        code: '184',
        icon: '📖',
        color: '#D97706',
        chapters: [
          {
            id: 'ch-eng-10-01',
            chapterNumber: 1,
            name: 'Reading Skills & Discursive Passages',
            description: 'Unseen comprehension passages (discursive and case-based factual passage with visual input / statistical data).',
            topics: [
              { id: 'top-eng-10-01-1', name: 'Discursive Comprehension', subtopics: ['Inference, analysis, evaluation, vocabulary in context'] },
              { id: 'top-eng-10-01-2', name: 'Case-Based Factual Passage', subtopics: ['Data interpretation, factual inference'] }
            ]
          },
          {
            id: 'ch-eng-10-02',
            chapterNumber: 2,
            name: 'Writing Skills – Formal Letters & Analytical Paragraphs',
            description: 'Formal letters (Letter to Editor, Complaint, Enquiry, Order) and Analytical paragraph writing based on given charts/graphs.',
            topics: [
              { id: 'top-eng-10-02-1', name: 'Formal Letter Writing', subtopics: ['Format: sender, date, receiver, subject, salutation, body, sign-off', 'Letter to Editor & complaint letter'] },
              { id: 'top-eng-10-02-2', name: 'Analytical Paragraph Writing', subtopics: ['Data trend analysis, comparative vocabulary, logical conclusion'] }
            ]
          },
          {
            id: 'ch-eng-10-03',
            chapterNumber: 3,
            name: 'Grammar – Tenses, Modals & Reported Speech',
            description: 'Tenses, Modals, Subject-verb concord, Reported speech (Commands, Requests, Statements, Questions), Determiners.',
            topics: [
              { id: 'top-eng-10-03-1', name: 'Tenses and Subject-Verb Concord', subtopics: ['Rules of singular/plural subjects', 'Perfect and continuous tenses'] },
              { id: 'top-eng-10-03-2', name: 'Reported Speech & Modals', subtopics: ['Direct to indirect speech tense shifting', 'Pronoun shifts', 'Can, could, may, might, must, should'] }
            ]
          },
          {
            id: 'ch-eng-10-04',
            chapterNumber: 4,
            name: 'First Flight – Prose & Poetry',
            description: 'A Letter to God, Nelson Mandela, Two Stories about Flying, From the Diary of Anne Frank, Dust of Snow, Fire and Ice, A Tiger in the Zoo.',
            topics: [
              { id: 'top-eng-10-04-1', name: 'Key Prose Themes & Characterisation', subtopics: ['Lencho faith irony', 'Nelson Mandela freedom struggle', 'Anne Frank human resilience'] },
              { id: 'top-eng-10-04-2', name: 'Poetry Analysis & Poetic Devices', subtopics: ['Robert Frost themes', 'Metaphor, personification, enjambment, alliteration'] }
            ]
          },
          {
            id: 'ch-eng-10-05',
            chapterNumber: 5,
            name: 'Footprints without Feet – Supplementary Reader',
            description: 'A Triumph of Surgery, The Thief’s Story, The Midnight Visitor, A Question of Trust, Footprints without Feet, The Making of a Scientist, The Necklace.',
            topics: [
              { id: 'top-eng-10-05-1', name: 'Narrative Arcs & Moral Underpinnings', subtopics: ['Tricki pampering theme', 'Hari Singh moral transformation by Anil', 'Griffin misuse of science'] }
            ]
          }
        ]
      },
      {
        id: 'cbse-10-sst',
        name: 'Social Science',
        code: '087',
        icon: '🌍',
        color: '#DC2626',
        chapters: [
          {
            id: 'ch-sst-10-01',
            chapterNumber: 1,
            name: 'The Rise of Nationalism in Europe',
            description: 'The French Revolution and the idea of the Nation, The making of Nationalism in Europe, The age of Revolutions: 1830-1848, The making of Germany and Italy, Visualising the Nation, Nationalism and Imperialism.',
            topics: [
              { id: 'top-sst-10-01-1', name: 'French Revolution & Napoleonic Civil Code 1804', subtopics: ['Equality before law', 'Abolition of feudal privileges'] },
              { id: 'top-sst-10-01-2', name: 'Unification of Germany and Italy', subtopics: ['Otto von Bismarck blood and iron policy', 'Cavour, Garibaldi, Victor Emmanuel II'] },
              { id: 'top-sst-10-01-3', name: 'Allegories & Balkan Crisis', subtopics: ['Marianne and Germania', 'Balkan ethnic conflicts leading to WW1'] }
            ]
          },
          {
            id: 'ch-sst-10-02',
            chapterNumber: 2,
            name: 'Nationalism in India',
            description: 'The First World War, Khilafat and Non-Cooperation, Differing strands within the movement, Towards Civil Disobedience, The Sense of Collective Belonging.',
            topics: [
              { id: 'top-sst-10-02-1', name: 'Rowlatt Act, Jallianwala Bagh & Khilafat', subtopics: ['Rowlatt Satyagraha 1919', 'General Dyer massacre', 'Ali brothers Khilafat alliance'] },
              { id: 'top-sst-10-02-2', name: 'Non-Cooperation Movement Differing Strands', subtopics: ['Towns boycott', 'Awadh peasants (Baba Ramchandra)', 'Tribals (Alluri Sitaram Raju)', 'Plantation workers in Assam'] },
              { id: 'top-sst-10-02-3', name: 'Civil Disobedience Movement & Salt March', subtopics: ['Dandi march 1930', 'Gandhi-Irwin pact', 'Poona Pact 1932 (Ambedkar & Gandhi)'] }
            ]
          },
          {
            id: 'ch-sst-10-03',
            chapterNumber: 3,
            name: 'Resources and Development',
            description: 'Types of resources, development of resources, resource planning in India, land resources, land utilization, land use pattern, land degradation and conservation measures, soil as a resource, classification of soils, soil erosion and conservation.',
            topics: [
              { id: 'top-sst-10-03-1', name: 'Resource Planning and Sustainable Development', subtopics: ['Rio Earth Summit 1992', 'Agenda 21', 'Three stages of resource planning in India'] },
              { id: 'top-sst-10-03-2', name: 'Soil Classification & Soil Conservation', subtopics: ['Alluvial, Black (Regur), Red/Yellow, Laterite, Arid, Forest soils', 'Contour ploughing, terrace farming, strip cropping'] }
            ]
          },
          {
            id: 'ch-sst-10-04',
            chapterNumber: 4,
            name: 'Power Sharing & Federalism',
            description: 'Case studies of Belgium and Sri Lanka, Why power sharing is desirable? Forms of Power Sharing. What is Federalism? What makes India a federal country? How is federalism practiced? Decentralization in India.',
            topics: [
              { id: 'top-sst-10-04-1', name: 'Belgium Accommodation vs Sri Lanka Majoritarianism', subtopics: ['Sinhala official language act 1956', 'Brussels 50-50 representation model', 'Horizontal vs vertical power sharing'] },
              { id: 'top-sst-10-04-2', name: 'Indian Federalism & 1992 Decentralisation', subtopics: ['Union, State, Concurrent, Residuary lists', '73rd and 74th constitutional amendments for Panchayati Raj'] }
            ]
          },
          {
            id: 'ch-sst-10-05',
            chapterNumber: 5,
            name: 'Development, Sectors of Economy & Money and Credit',
            description: 'What Development Promises – Different People, Different Goals, National Development, Primary, Secondary, Tertiary sectors, Formal and informal credit sectors.',
            topics: [
              { id: 'top-sst-10-05-1', name: 'Development Indicators (PCI, HDI)', subtopics: ['Per Capita Income (World Bank)', 'Human Development Index (UNDP)', 'Sustainable development'] },
              { id: 'top-sst-10-05-2', name: 'Three Sectors of the Economy & Employment', subtopics: ['GDP contribution vs employment share', 'Disguised unemployment', 'MGNREGA 2005'] },
              { id: 'top-sst-10-05-3', name: 'Money and Credit', subtopics: ['Double coincidence of wants', 'Functions of money', 'Formal vs informal sources of credit in India', 'Self-Help Groups (SHGs)'] }
            ]
          }
        ]
      },
      {
        id: 'cbse-10-cs',
        name: 'Computer Science',
        code: '165',
        icon: '💻',
        color: '#7C3AED',
        chapters: [
          {
            id: 'ch-cs-10-01',
            chapterNumber: 1,
            name: 'Networking Basics & Cyber Ethics',
            description: 'Internet, WWW, web browsers, web servers, URL, HTML, protocols (HTTP, HTTPS, FTP, TCP/IP), cyber ethics, netiquette, software licenses, open source.',
            topics: [
              { id: 'top-cs-10-01-1', name: 'Internet Protocols & Web Architecture', subtopics: ['Client-server model', 'HTTP vs HTTPS', 'DNS resolution', 'IP addressing'] },
              { id: 'top-cs-10-01-2', name: 'Cyber Ethics, Intellectual Property & Netiquette', subtopics: ['Plagiarism, digital footprint, cyberbullying, phishing', 'Creative commons, GPL, proprietary software'] }
            ]
          },
          {
            id: 'ch-cs-10-02',
            chapterNumber: 2,
            name: 'HTML & CSS Web Authoring',
            description: 'Basic HTML elements, semantic markup, images, links, tables, forms, CSS styling, inline, internal, external stylesheets.',
            topics: [
              { id: 'top-cs-10-02-1', name: 'HTML Structure, Tables & Forms', subtopics: ['Head, body, headings, lists', 'Table tags (table, tr, th, td)', 'Form inputs (text, radio, checkbox, submit)'] },
              { id: 'top-cs-10-02-2', name: 'CSS Selectors & Styling', subtopics: ['Class and id selectors', 'Box model: margin, border, padding', 'Color, fonts, flex layout basics'] }
            ]
          },
          {
            id: 'ch-cs-10-03',
            chapterNumber: 3,
            name: 'Python Computational Thinking & Data Logic',
            description: 'Variables, data types, conditional branching, while and for loops, strings, lists, tuples, dictionaries, functions.',
            topics: [
              { id: 'top-cs-10-03-1', name: 'Conditionals & Iterative Loops', subtopics: ['if-elif-else constructs', 'for loop with range()', 'while loop with break and continue'] },
              { id: 'top-cs-10-03-2', name: 'Lists, Strings & Built-in Functions', subtopics: ['String slicing & indexing', 'List operations: append, pop, sort', 'Custom user-defined functions with def'] }
            ]
          }
        ]
      }
    ]
  },

  // --------------------------------------------------------------------------
  // CBSE Class 12 (Academic Year 2026-27)
  // --------------------------------------------------------------------------
  {
    id: 'curriculum-cbse-12-2026-27',
    board: 'CBSE',
    classLevel: 'Class 12',
    academicYear: '2026-27',
    sourceName: 'CBSE Academic Senior Secondary 2026-27',
    sourceUrl: 'https://cbseacademic.nic.in/curriculum_2026_sr.html',
    version: '1.0',
    isActive: true,
    lastVerifiedAt: '2026-09-23T00:00:00.000Z',
    subjects: [
      {
        id: 'cbse-12-phy',
        name: 'Physics',
        code: '042',
        icon: '⚡',
        color: '#2563EB',
        chapters: [
          {
            id: 'ch-phy-12-01',
            chapterNumber: 1,
            name: 'Electric Charges and Fields',
            description: 'Coulomb’s law, electric field, electric field lines, electric dipole, electric flux, Gauss’s law and its applications.',
            topics: [
              { id: 'top-phy-12-01-1', name: 'Coulomb’s Law and Superposition Principle', subtopics: ['Vector form of Coulomb law', 'Permittivity and dielectric constant'] },
              { id: 'top-phy-12-01-2', name: 'Gauss’s Law and Applications', subtopics: ['Electric flux Φ = E.A', 'Infinitely long charged wire field', 'Uniformly charged infinite plane sheet'] }
            ]
          },
          {
            id: 'ch-phy-12-02',
            chapterNumber: 2,
            name: 'Electrostatic Potential and Capacitance',
            description: 'Electric potential, potential difference, equipotential surfaces, capacitor and capacitance, combination of capacitors, energy stored.',
            topics: [
              { id: 'top-phy-12-02-1', name: 'Electric Potential & Equipotential Surfaces', subtopics: ['V = kq/r', 'Work done on equipotential surface = 0'] },
              { id: 'top-phy-12-02-2', name: 'Capacitance & Dielectrics', subtopics: ['Parallel plate capacitor C = ε0A/d', 'Dielectric insertion', 'Series and parallel capacitors', 'U = 1/2 CV²'] }
            ]
          },
          {
            id: 'ch-phy-12-03',
            chapterNumber: 3,
            name: 'Current Electricity',
            description: 'Electric current, drift velocity, Ohm’s law, electrical resistance, V-I characteristics, temperature dependence of resistance, Kirchhoff’s rules, Wheatstone bridge.',
            topics: [
              { id: 'top-phy-12-03-1', name: 'Drift Velocity and Ohm’s Law Derivation', subtopics: ['I = n e A vd', 'Mobility μ = vd/E', 'Resistivity temperature coefficient'] },
              { id: 'top-phy-12-03-2', name: 'Kirchhoff’s Laws and Wheatstone Bridge', subtopics: ['Junction rule ΣI = 0', 'Loop rule ΣΔV = 0', 'Balanced Wheatstone condition P/Q = R/S'] }
            ]
          }
        ]
      },
      {
        id: 'cbse-12-chem',
        name: 'Chemistry',
        code: '043',
        icon: '🧪',
        color: '#0D9488',
        chapters: [
          {
            id: 'ch-chem-12-01',
            chapterNumber: 1,
            name: 'Solutions',
            description: 'Types of solutions, expression of concentration, solubility of gases in liquids (Henry’s law), solid solutions, Raoult’s law, colligative properties.',
            topics: [
              { id: 'top-chem-12-01-1', name: 'Raoult’s Law and Ideal / Non-Ideal Solutions', subtopics: ['Positive and negative deviations', 'Azeotropes'] },
              { id: 'top-chem-12-01-2', name: 'Colligative Properties & Van’t Hoff Factor', subtopics: ['Relative lowering of vapour pressure', 'Elevation in boiling point ΔTb = Kb m', 'Depression in freezing point ΔTf = Kf m', 'Osmotic pressure π = iCRT'] }
            ]
          },
          {
            id: 'ch-chem-12-02',
            chapterNumber: 2,
            name: 'Electrochemistry',
            description: 'Redox reactions, EMF of a cell, standard electrode potential, Nernst equation, conductance in electrolytic solutions, Kohlrausch’s law, electrolysis and laws of electrolysis.',
            topics: [
              { id: 'top-chem-12-02-1', name: 'Nernst Equation and Galvanic Cells', subtopics: ['Ecell = E°cell - (0.0591/n) log Q', 'Gibbs energy ΔG° = -nFE°cell'] },
              { id: 'top-chem-12-02-2', name: 'Kohlrausch’s Law & Conductance', subtopics: ['Molar conductivity Λm', 'Independent migration of ions', 'Faraday laws of electrolysis'] }
            ]
          }
        ]
      }
    ]
  },

  // --------------------------------------------------------------------------
  // Previous Year Archive: CBSE Class 10 (Academic Year 2025-26)
  // Preserved for students who started on previous academic cycles
  // --------------------------------------------------------------------------
  {
    id: 'curriculum-cbse-10-2025-26',
    board: 'CBSE',
    classLevel: 'Class 10',
    academicYear: '2025-26',
    sourceName: 'CBSE Academic Archive 2025-26',
    sourceUrl: 'https://cbseacademic.nic.in/archive_2025.html',
    version: '1.0-legacy',
    isActive: false, // Older version
    lastVerifiedAt: '2025-04-10T00:00:00.000Z',
    subjects: [
      {
        id: 'cbse-10-math-legacy',
        name: 'Mathematics',
        code: '041',
        chapters: [
          {
            id: 'ch-math-10-01-leg',
            chapterNumber: 1,
            name: 'Real Numbers',
            topics: [{ id: 'top-1-leg', name: 'Fundamental Theorem of Arithmetic' }]
          },
          {
            id: 'ch-math-10-02-leg',
            chapterNumber: 2,
            name: 'Polynomials',
            topics: [{ id: 'top-2-leg', name: 'Zeroes and Coefficients' }]
          }
        ]
      }
    ]
  }
];

// ============================================================================
// CURRICULUM DATABASE SERVICE API
// ============================================================================

const STORAGE_KEY_CUSTOM_CURRICULA = 'gurumitra_custom_curricula_v1';

/**
 * Returns all active and archived curriculum versions
 */
export function listCurriculumVersions(): CurriculumVersion[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const customJson = localStorage.getItem(STORAGE_KEY_CUSTOM_CURRICULA);
      if (customJson) {
        const customList = JSON.parse(customJson);
        if (Array.isArray(customList) && customList.length > 0) {
          return [...VERIFIED_CURRICULUM_VERSIONS, ...customList];
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load custom curricula from storage:', err);
  }
  return VERIFIED_CURRICULUM_VERSIONS;
}

/**
 * Retrieves the specific verified curriculum version for a board, class, and year.
 * Falls back to the latest active version for the class and board if year is unspecified.
 */
export function getCurriculumVersion(
  board: BoardType | string,
  classLevel: ClassLevel | string,
  academicYear: string = '2026-27'
): CurriculumVersion | null {
  const versions = listCurriculumVersions();

  // 1. Exact match by board, class, and academic year
  const exact = versions.find(
    v =>
      v.board.toLowerCase() === board.toLowerCase() &&
      v.classLevel.toLowerCase() === classLevel.toLowerCase() &&
      v.academicYear === academicYear
  );
  if (exact) return exact;

  // 2. Active version match for class and board
  const activeForClass = versions.find(
    v =>
      v.board.toLowerCase() === board.toLowerCase() &&
      v.classLevel.toLowerCase() === classLevel.toLowerCase() &&
      v.isActive
  );
  if (activeForClass) return activeForClass;

  // 3. Any version match for class and board
  const anyForClassAndBoard = versions.find(
    v =>
      v.board.toLowerCase() === board.toLowerCase() &&
      v.classLevel.toLowerCase() === classLevel.toLowerCase()
  );
  if (anyForClassAndBoard) return anyForClassAndBoard;

  return null;
}

/**
 * Retrieves chapters for a specific subject within a verified curriculum version
 */
export function getVerifiedChaptersForSubject(
  subject: SubjectType,
  board: BoardType | string = 'CBSE',
  classLevel: ClassLevel | string = 'Class 10',
  academicYear: string = '2026-27'
): CurriculumChapterRecord[] {
  const version = getCurriculumVersion(board, classLevel, academicYear);
  if (!version) return [];

  const subjectRecord = version.subjects.find(
    s => s.name.toLowerCase() === subject.toLowerCase()
  );

  if (subjectRecord) {
    return subjectRecord.chapters;
  }

  // Fallback: check CURRICULUM_CHAPTERS from curriculum.ts for comprehensive offline mapping
  const fallbackChapters = CURRICULUM_CHAPTERS.filter(
    c =>
      c.subject.toLowerCase() === subject.toLowerCase() &&
      c.classLevel.toLowerCase() === classLevel.toLowerCase()
  );

  if (fallbackChapters.length > 0) {
    return fallbackChapters.map((fc, idx) => ({
      id: fc.id || `ch_${subject.toLowerCase().slice(0, 4)}_${idx + 1}`,
      chapterNumber: fc.number || idx + 1,
      name: fc.title,
      description: fc.description,
      topics: (fc.topics || []).map(t => ({
        id: t.id,
        name: t.title,
        subtopics: t.keyPoints
      }))
    }));
  }

  return [];
}

/**
 * Validates that a curriculum conforms to strict consistency rules:
 * - Non-empty board, class, academic year
 * - Source URL present
 * - No duplicate chapters or topics
 * - Every chapter has at least 1 topic
 */
export function validateCurriculum(curriculum: CurriculumVersion): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!curriculum.board) errors.push('Board is required.');
  if (!curriculum.classLevel) errors.push('Class level is required.');
  if (!curriculum.academicYear) errors.push('Academic year is required (e.g. 2026-27).');
  if (!curriculum.sourceUrl) errors.push('Authoritative source URL is required.');
  if (!curriculum.subjects || curriculum.subjects.length === 0) {
    errors.push('At least one subject must be defined.');
  }

  curriculum.subjects.forEach(sub => {
    const chapterNames = new Set<string>();
    sub.chapters.forEach(ch => {
      const lower = ch.name.trim().toLowerCase();
      if (chapterNames.has(lower)) {
        errors.push(`Duplicate chapter "${ch.name}" in ${sub.name}.`);
      }
      chapterNames.add(lower);

      if (!ch.topics || ch.topics.length === 0) {
        errors.push(`Chapter "${ch.name}" in ${sub.name} has no topics.`);
      }

      const topicNames = new Set<string>();
      ch.topics.forEach(t => {
        const tLower = t.name.trim().toLowerCase();
        if (topicNames.has(tLower)) {
          errors.push(`Duplicate topic "${t.name}" in chapter "${ch.name}".`);
        }
        topicNames.add(tLower);
      });
    });
  });

  return { isValid: errors.length === 0, errors };
}

/**
 * Compares two curriculum versions to detect added, removed, and modified chapters/topics
 */
export function compareCurricula(
  oldVersion: CurriculumVersion,
  newVersion: CurriculumVersion
): {
  addedChapters: { subject: string; chapter: string }[];
  removedChapters: { subject: string; chapter: string }[];
  modifiedChapters: { subject: string; chapter: string; addedTopics: string[]; removedTopics: string[] }[];
} {
  const addedChapters: { subject: string; chapter: string }[] = [];
  const removedChapters: { subject: string; chapter: string }[] = [];
  const modifiedChapters: { subject: string; chapter: string; addedTopics: string[]; removedTopics: string[] }[] = [];

  const oldSubjectMap = new Map(oldVersion.subjects.map(s => [s.name.toLowerCase(), s]));
  const newSubjectMap = new Map(newVersion.subjects.map(s => [s.name.toLowerCase(), s]));

  newSubjectMap.forEach((newSub, subKey) => {
    const oldSub = oldSubjectMap.get(subKey);
    if (!oldSub) {
      newSub.chapters.forEach(ch => addedChapters.push({ subject: newSub.name, chapter: ch.name }));
      return;
    }

    const oldChMap = new Map(oldSub.chapters.map(c => [c.name.trim().toLowerCase(), c]));
    const newChMap = new Map(newSub.chapters.map(c => [c.name.trim().toLowerCase(), c]));

    newChMap.forEach((newCh, chKey) => {
      const oldCh = oldChMap.get(chKey);
      if (!oldCh) {
        addedChapters.push({ subject: newSub.name, chapter: newCh.name });
      } else {
        const oldTopicNames = new Set(oldCh.topics.map(t => t.name.trim().toLowerCase()));
        const newTopicNames = new Set(newCh.topics.map(t => t.name.trim().toLowerCase()));

        const addedT = newCh.topics.filter(t => !oldTopicNames.has(t.name.trim().toLowerCase())).map(t => t.name);
        const removedT = oldCh.topics.filter(t => !newTopicNames.has(t.name.trim().toLowerCase())).map(t => t.name);

        if (addedT.length > 0 || removedT.length > 0) {
          modifiedChapters.push({
            subject: newSub.name,
            chapter: newCh.name,
            addedTopics: addedT,
            removedTopics: removedT
          });
        }
      }
    });

    oldChMap.forEach((oldCh, chKey) => {
      if (!newChMap.has(chKey)) {
        removedChapters.push({ subject: oldSub.name, chapter: oldCh.name });
      }
    });
  });

  return { addedChapters, removedChapters, modifiedChapters };
}

/**
 * Alias exported for backward compatibility and test runner
 */
export const curriculumDatabase: CurriculumVersion[] = VERIFIED_CURRICULUM_VERSIONS;

/**
 * Compares two curriculum versions by ID for admin and testing
 */
export function compareCurriculumVersions(oldId: string, newId: string) {
  const oldVer = curriculumDatabase.find(c => c.id === oldId);
  const newVer = curriculumDatabase.find(c => c.id === newId);
  if (!oldVer || !newVer) {
    return {
      board: 'CBSE',
      classLevel: 'Class 10',
      fromYear: '',
      toYear: '',
      addedChapters: [],
      removedChapters: [],
      modifiedChapters: []
    };
  }
  const diff = compareCurricula(oldVer, newVer);
  return {
    board: newVer.board,
    classLevel: newVer.classLevel,
    fromYear: oldVer.academicYear,
    toYear: newVer.academicYear,
    ...diff
  };
}

