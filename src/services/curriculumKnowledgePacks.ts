import {
  AdaptiveLessonContent,
  AdaptiveSubtopic,
  AdaptiveTheoryQuestion,
  AdaptivePracticeQuestion,
  AdaptiveTheoryReviewQuestion
} from '../types';

export interface KnowledgePackParams {
  classLevel: string;
  board: string;
  subject: string;
  chapter: string;
  topic: string;
  subtopics?: string[];
  studentLevel: 'Weak' | 'Average' | 'Strong';
  allocatedMinutes: number;
}

/**
 * Builds rich, subject-appropriate curriculum lessons for any subject and topic.
 */
export function buildSubjectCurriculumLesson(params: KnowledgePackParams): AdaptiveLessonContent {
  const {
    classLevel = '10th',
    board = 'CBSE',
    subject = 'English',
    chapter = 'Tenses',
    topic = 'Continuous',
    studentLevel = 'Average',
    allocatedMinutes = 45
  } = params;

  const sLower = (subject || '').toLowerCase();
  const cLower = (chapter || '').toLowerCase();
  const tLower = (topic || '').toLowerCase();

  // --------------------------------------------------------------------------
  // 1. ENGLISH: TENSES -> CONTINUOUS (PROGRESSIVE)
  // --------------------------------------------------------------------------
  if (sLower.includes('english') && (tLower.includes('continuous') || cLower.includes('continuous') || tLower.includes('tense') || cLower.includes('tense'))) {
    const subtopics: AdaptiveSubtopic[] = [
      {
        id: 'sub_1',
        title: '1. Meaning of the Continuous (Progressive) Aspect',
        explanation: studentLevel === 'Weak'
          ? 'In English, continuous means an action is happening right now, at this exact moment, and is not finished yet. We always form it using a helping verb (is, am, are, was, were) followed by the main verb ending in -ing (playing, reading, studying).'
          : 'The continuous (or progressive) aspect expresses actions that are ongoing, temporary, or in progress at a specific reference time. Unlike the simple aspect which expresses facts or habits, the continuous aspect focuses on the duration and incompleteness of the action.',
        formulaOrRule: 'Subject + Be Verb (is / am / are / was / were / will be) + Verb-ing (Present Participle) + Object',
        intuition: 'Picture a live video recording in progress, not a snapshot photograph of a completed event.',
        example: 'He is writing a letter. (The action is in progress right now as we speak).',
        commonMistake: 'Omitting the auxiliary verb "be": saying "He writing a letter" instead of "He is writing a letter".',
        importantPoints: [
          'Denotes incomplete or ongoing actions',
          'Requires appropriate form of auxiliary verb "be"',
          'Main verb always takes the -ing suffix'
        ]
      },
      {
        id: 'sub_2',
        title: '2. Present Continuous Tense: Structure & Daily Usage',
        explanation: 'Used for actions happening at the moment of speaking, or temporary situations happening around the present time (these days, this week).',
        formulaOrRule: 'Subject + is / am / are + V-ing  [I am, He/She/It is, You/We/They are]',
        intuition: 'Use "am" with I, "is" with singular third-person subjects, and "are" with plural subjects and you.',
        example: 'Positive: "They are studying for their exams." Negative: "She is not watching television."',
        commonMistake: 'Using incorrect subject-verb agreement: e.g. "They is playing" or "He are studying".',
        importantPoints: [
          'Signal words: now, right now, at the moment, currently, this week',
          'Negative: Subject + is/am/are + not + V-ing',
          'Interrogative: Is/Am/Are + Subject + V-ing?'
        ]
      },
      {
        id: 'sub_3',
        title: '3. Past Continuous Tense: Background & Interrupted Actions',
        explanation: 'Describes an action that was going on at some point in the past. It is frequently paired with the Simple Past to show an action that was interrupted by another event.',
        formulaOrRule: 'Subject + was / were + V-ing  [I/He/She/It was, You/We/They were]',
        intuition: 'The past continuous provides the background setting (the longer action), while the simple past represents the interrupting event (the shorter action).',
        example: 'While I was doing my homework, the doorbell rang.',
        commonMistake: 'Using "were" with singular pronouns: e.g. "He were reading" instead of "He was reading".',
        importantPoints: [
          'Longer background action: Past Continuous (was/were + V-ing)',
          'Shorter interrupting action: Simple Past (V2)',
          'Often accompanied by time clauses starting with "when" or "while"'
        ]
      },
      {
        id: 'sub_4',
        title: '4. Future Continuous Tense: Scheduled & Anticipated Actions',
        explanation: 'Indicates an action that will be in progress at a specific time in the future, or fixed routine events.',
        formulaOrRule: 'Subject + will be / shall be + V-ing',
        intuition: 'Mentions where someone will be or what they will be actively doing at a future clock hour or date.',
        example: 'At 10 AM tomorrow, we will be attending the science exhibition.',
        commonMistake: 'Forgetting "be": writing "We will attending" instead of "We will be attending".',
        importantPoints: [
          'Denotes future action in progress at a designated future time',
          'Structure: will be + V-ing',
          'Frequently used in board writing sections (formal dialogues and reports)'
        ]
      },
      {
        id: 'sub_5',
        title: '5. The Stative Verbs Rule (Verbs That NEVER Take Continuous)',
        explanation: 'Certain English verbs describe states, emotions, perceptions, or possessions rather than active physical processes. In standard CBSE English, these verbs are NOT used in continuous forms; use simple tenses instead.',
        formulaOrRule: 'Stative Verbs = Simple Tense ONLY (know, believe, understand, love, hate, smell, see, belong, cost)',
        intuition: 'You cannot voluntarily "be in the middle of" possessing something or knowing a fact.',
        example: 'Incorrect: "I am knowing the answer." Correct: "I know the answer."',
        commonMistake: 'Writing "She is having two cars" instead of "She has two cars" (when indicating possession).',
        importantPoints: [
          'Perception: see, hear, smell, taste',
          'Cognition: know, understand, believe, remember',
          'Emotion & Possession: love, prefer, own, belong'
        ]
      },
      {
        id: 'sub_6',
        title: '6. Present Continuous for Fixed Future Arrangements',
        explanation: 'The present continuous is also used to express near-future personal arrangements that have already been confirmed with dates, tickets, or appointments.',
        formulaOrRule: 'Subject + is/am/are + V-ing + Future Time Marker (tomorrow, next Friday, tonight)',
        intuition: 'Because plans are already booked in the present, we treat the preparation as currently unfolding.',
        example: 'I am visiting my grandparents this Saturday. (The tickets are booked).',
        commonMistake: 'Confusing personal arrangements (Present Continuous) with general predictions (will + base verb).',
        importantPoints: [
          'Requires a future time indicator',
          'Reflects pre-planned decisions and appointments',
          'High-yield board question pattern in sentence transformation'
        ]
      },
      {
        id: 'sub_7',
        title: '7. Common Board Exam Error Correction Patterns',
        explanation: 'CBSE error-correction questions frequently test spelling changes when adding -ing (run → running, die → dying, make → making) and incorrect tense consistency.',
        formulaOrRule: 'Spelling rules: CVC rule doubles consonant (stop → stopping); drop final silent e (write → writing); ie becomes y (lie → lying).',
        intuition: 'Check auxiliary verb agreement, verify stative verb constraints, and check spelling doubling rules.',
        example: 'Error: "She is runing fast." Correction: "She is running fast."',
        commonMistake: 'Forgetting to double the final consonant in one-syllable verbs with a single short vowel.',
        importantPoints: [
          'Watch for double consonants in CVC verbs (swim → swimming)',
          'Change -ie to -y (tie → tying)',
          'Ensure subject-verb concord with collective nouns'
        ]
      }
    ];

    const theory_qa: AdaptiveTheoryReviewQuestion[] = [
      {
        id: 'tqa_1',
        question: 'How does the continuous aspect fundamentally differ from the simple aspect in English grammar?',
        theoreticalAnswer: 'The simple aspect is used to state general facts, permanent truths, routines, or completed events (e.g., "The sun rises in the east", "I study daily"). In contrast, the continuous (progressive) aspect expresses actions that are actively ongoing, in progress, or temporary at a designated reference point (e.g., "I am studying now").',
        keyPoints: ['Simple = facts, routines, permanent states', 'Continuous = ongoing, temporary, incomplete actions', 'Continuous requires auxiliary verb be + V-ing'],
        boardMarkingTip: 'Clearly contrast the temporary/in-progress nature of continuous with the habitual/permanent nature of simple tense.'
      },
      {
        id: 'tqa_2',
        question: 'Explain why "I am knowing the answer" is grammatically incorrect according to standard English rules.',
        theoreticalAnswer: 'The verb "know" is a stative verb representing an internal mental state of cognition rather than a physical or observable action. In standard English, stative verbs do not take continuous aspect because one cannot be in the ongoing process of knowing; one either possesses the knowledge or does not. The correct sentence is "I know the answer".',
        keyPoints: ['Stative verb of cognition', 'Expresses state, not voluntary physical action', 'Correct form is Simple Present: "I know"'],
        boardMarkingTip: 'Explicitly identify "know" as a stative verb and mention that stative verbs take simple tenses.'
      },
      {
        id: 'tqa_3',
        question: 'Describe how Past Continuous and Simple Past are combined in complex sentences with an example.',
        theoreticalAnswer: 'When two actions occur in the past such that one action interrupts another, the longer ongoing background action is framed in the Past Continuous tense (was/were + V-ing), while the shorter interrupting action is framed in the Simple Past tense (V2). For example: "While she was reading a novel, the telephone rang." Here, reading was ongoing, and the telephone ringing was the sudden interruption.',
        keyPoints: ['Longer action = Past Continuous', 'Interrupting event = Simple Past', 'Connected using conjunctions "when" or "while"'],
        boardMarkingTip: 'State the distinction between background ongoing action (Past Continuous) and sudden interruption (Simple Past).'
      },
      {
        id: 'tqa_4',
        question: 'State the rule for using Present Continuous to express future events and provide an illustrative sentence.',
        theoreticalAnswer: 'The Present Continuous tense can indicate future time when referring to planned, confirmed personal arrangements or appointments that have already been decided upon prior to speaking. It must usually be accompanied by a specific future time marker. For example: "We are flying to Mumbai next Tuesday." This implies tickets have been purchased and the plan is firm.',
        keyPoints: ['Fixed personal arrangements', 'Requires future time adverbial (e.g. tomorrow, next week)', 'Differentiates from instant decisions with "will"'],
        boardMarkingTip: 'Mention that a specific future time expression is required to prevent ambiguity with current actions.'
      },
      {
        id: 'tqa_5',
        question: 'What are the main orthographic (spelling) rules when converting base verbs into present participles (-ing form)?',
        theoreticalAnswer: 'There are three primary spelling rules: 1) For verbs ending in a silent "e", drop the "e" before adding -ing (e.g., write → writing, make → making); 2) For one-syllable verbs ending in Consonant-Vowel-Consonant (CVC), double the final consonant (e.g., run → running, sit → sitting); 3) For verbs ending in "-ie", change "-ie" to "-y" before adding -ing (e.g., die → dying, lie → lying).',
        keyPoints: ['Drop final silent e', 'Double final consonant in short CVC verbs', 'Change -ie to -y'],
        boardMarkingTip: 'Provide at least two contrasting examples for each spelling alteration rule.'
      }
    ];

    const summary = [
      'The Continuous Aspect (be + V-ing) expresses actions that are ongoing, temporary, or incomplete.',
      'Present Continuous (is/am/are + V-ing) describes actions happening now or near-future fixed arrangements.',
      'Past Continuous (was/were + V-ing) sets the background for an action interrupted by Simple Past.',
      'Future Continuous (will be + V-ing) projects an ongoing action at a specific future moment.',
      'Stative verbs (know, believe, understand, smell, own) are NOT used in continuous forms; use simple tenses.',
      'Spelling changes: drop silent e (write → writing), double short CVC consonants (run → running), and change -ie to -y (die → dying).'
    ];

    const questions: AdaptiveTheoryQuestion[] = [
      {
        id: 'q_th_1',
        question: 'Identify the correct sentence in the Present Continuous tense:',
        difficulty: 'easy',
        options: [
          'She is writing an essay at the moment.',
          'She writing an essay at the moment.',
          'She writes an essay at the moment.',
          'She has written an essay at the moment.'
        ],
        correctOptionIndex: 0,
        answer: 'She is writing an essay at the moment.',
        explanation: 'Present Continuous requires Subject + is/am/are + present participle (V-ing). "She is writing" correctly satisfies this rule with the time marker "at the moment".',
        conceptTested: 'Present Continuous Structure'
      },
      {
        id: 'q_th_2',
        question: 'Which of the following verbs is a STATIVE verb that normally does not take the continuous form?',
        difficulty: 'easy',
        options: ['Understand', 'Run', 'Sing', 'Eat'],
        correctOptionIndex: 0,
        answer: 'Understand',
        explanation: '"Understand" is a stative verb of mental cognition. We say "I understand the concept", not "I am understanding the concept". The other options are dynamic action verbs.',
        conceptTested: 'Stative Verbs'
      },
      {
        id: 'q_th_3',
        question: 'Fill in the blank with the correct Past Continuous form: "The students _______ in the library when the fire alarm rang."',
        difficulty: 'easy',
        options: ['were studying', 'was studying', 'are studying', 'studied'],
        correctOptionIndex: 0,
        answer: 'were studying',
        explanation: '"The students" is a plural subject in the past tense, requiring "were" + V-ing ("were studying").',
        conceptTested: 'Past Continuous Subject-Verb Agreement'
      },
      {
        id: 'q_th_4',
        question: 'What is the correct negative form of "He is playing badminton"?',
        difficulty: 'easy',
        options: [
          'He is not playing badminton.',
          'He not is playing badminton.',
          'He does not playing badminton.',
          'He is not play badminton.'
        ],
        correctOptionIndex: 0,
        answer: 'He is not playing badminton.',
        explanation: 'Negative sentences in Present Continuous are formed by placing "not" immediately after the auxiliary verb "be": Subject + is/am/are + not + V-ing.',
        conceptTested: 'Negative Continuous Structure'
      },
      {
        id: 'q_th_5',
        question: 'In the sentence "While my mother was cooking dinner, my father _______ home.", which verb form correctly completes the sentence?',
        difficulty: 'moderate',
        options: ['arrived', 'was arriving', 'is arriving', 'has arrived'],
        correctOptionIndex: 0,
        answer: 'arrived',
        explanation: 'The longer ongoing background action is in Past Continuous ("was cooking"), while the sudden interrupting action must be in Simple Past ("arrived").',
        conceptTested: 'Interrupted Past Actions'
      },
      {
        id: 'q_th_6',
        question: 'Choose the grammatically correct sentence showing a pre-planned future arrangement:',
        difficulty: 'moderate',
        options: [
          'We are meeting the doctor tomorrow at 4 PM.',
          'We will be meet the doctor tomorrow at 4 PM.',
          'We meeting the doctor tomorrow at 4 PM.',
          'We are meet the doctor tomorrow at 4 PM.'
        ],
        correctOptionIndex: 0,
        answer: 'We are meeting the doctor tomorrow at 4 PM.',
        explanation: 'Present Continuous is standardly used for scheduled future appointments when paired with a specific future time marker ("tomorrow at 4 PM").',
        conceptTested: 'Present Continuous for Future'
      },
      {
        id: 'q_th_7',
        question: 'Identify the sentence with INCORRECT usage of continuous tense:',
        difficulty: 'moderate',
        options: [
          'This house is belonging to my grandfather.',
          'This house belongs to my grandfather.',
          'They are painting the house white.',
          'He was repairing the fence yesterday.'
        ],
        correctOptionIndex: 0,
        answer: 'This house is belonging to my grandfather.',
        explanation: '"Belong" is a stative verb indicating possession and cannot take continuous form. It must be phrased in the Simple Present: "This house belongs to my grandfather".',
        conceptTested: 'Stative Verb Error Detection'
      },
      {
        id: 'q_th_8',
        question: 'What is the correct spelling of the present participle (-ing) form of the verb "lie" (to recline)?',
        difficulty: 'moderate',
        options: ['lying', 'lieing', 'lyeing', 'liing'],
        correctOptionIndex: 0,
        answer: 'lying',
        explanation: 'Verbs ending in "-ie" change "-ie" to "-y" before adding "-ing" (lie → lying, die → dying, tie → tying).',
        conceptTested: 'Participle Spelling Rules'
      },
      {
        id: 'q_th_9',
        question: 'Complete the sentence with the correct Future Continuous form: "Don’t call him at 8 PM tonight because he _______ his dinner."',
        difficulty: 'hard',
        options: [
          'will be having',
          'will having',
          'is have',
          'will have been'
        ],
        correctOptionIndex: 0,
        answer: 'will be having',
        explanation: 'Future Continuous requires "will be + V-ing" to express an action that will be actively ongoing at a specified future moment (8 PM tonight).',
        conceptTested: 'Future Continuous Usage'
      },
      {
        id: 'q_th_10',
        question: 'In CBSE error correction, identify the correct edited version of: "The committee are meeting tomorrow, but they are not agreeing on the agenda."',
        difficulty: 'hard',
        options: [
          '"The committee is meeting tomorrow, but they do not agree on the agenda."',
          '"The committee will meet tomorrow, but they are agreeing on the agenda."',
          '"The committee meeting tomorrow, but they does not agree on the agenda."',
          '"The committee are met tomorrow, but they were not agree on the agenda."'
        ],
        correctOptionIndex: 0,
        answer: '"The committee is meeting tomorrow, but they do not agree on the agenda."',
        explanation: '"Committee" takes singular verb "is meeting" for scheduled plan, and "agree" is a stative verb of opinion which must be in Simple Present ("do not agree"), not continuous ("are not agreeing").',
        conceptTested: 'Advanced Concord and Stative Combination'
      }
    ];

    const practice: AdaptivePracticeQuestion[] = [
      {
        id: 'q_pr_1',
        question: 'Choose the correct form: "Listen! Somebody _______ at the front gate."',
        difficulty: 'easy',
        options: ['is knocking', 'knocks', 'was knocked', 'knocking'],
        correctOptionIndex: 0,
        answer: 'is knocking',
        explanation: 'The imperative exclamation "Listen!" indicates an action occurring right at this moment, necessitating the Present Continuous tense.',
        hint: 'Exclamations like "Look!" or "Listen!" signal actions happening in the immediate present.'
      },
      {
        id: 'q_pr_2',
        question: 'Correct the error in the sentence: "I am having two sisters and one brother."',
        difficulty: 'easy',
        options: [
          'I have two sisters and one brother.',
          'I was having two sisters and one brother.',
          'I will have two sisters and one brother.',
          'I am have two sisters and one brother.'
        ],
        correctOptionIndex: 0,
        answer: 'I have two sisters and one brother.',
        explanation: 'When "have" expresses family relationships or ownership, it is a stative verb and cannot take the continuous tense.',
        hint: 'When "have" denotes possession rather than eating, use the simple present.'
      },
      {
        id: 'q_pr_3',
        question: 'Fill in the blank: "At this exact time next week, we _______ across the Himalayas."',
        difficulty: 'moderate',
        options: ['will be trekking', 'will trek', 'are trekking', 'were trekking'],
        correctOptionIndex: 0,
        answer: 'will be trekking',
        explanation: 'An action ongoing at a specified future time ("at this exact time next week") requires the Future Continuous: will be + V-ing.',
        hint: 'Use the future continuous formula: will be + V-ing.'
      },
      {
        id: 'q_pr_4',
        question: 'Identify the sentence where the verb "smell" is used CORRECTLY in the continuous form:',
        difficulty: 'hard',
        options: [
          'The chef is smelling the soup to check the spices.',
          'This flower is smelling very fragrant.',
          'The perfume is smelling sweet today.',
          'The kitchen is smelling of freshly baked cookies.'
        ],
        correctOptionIndex: 0,
        answer: 'The chef is smelling the soup to check the spices.',
        explanation: 'When "smell" denotes an active, voluntary physical action (sniffing), it can take the continuous tense. When it denotes an innate sensory property, it is stative and cannot take continuous.',
        hint: 'Can the subject perform a voluntary deliberate action with their nose?'
      },
      {
        id: 'q_pr_5',
        question: 'Complete the sentence with the correct continuous form: "The water in the kettle _______ rapidly; please turn off the stove."',
        difficulty: 'moderate',
        options: ['is boiling', 'boils', 'boiled', 'was boil'],
        correctOptionIndex: 0,
        answer: 'is boiling',
        explanation: '"Please turn off the stove" indicates the boiling is happening at this very moment, so Present Continuous ("is boiling") is required.',
        hint: 'The action is currently ongoing, requiring is/am/are + V-ing.'
      }
    ];

    return {
      id: `lesson_eng_${topic.toLowerCase()}_${Date.now()}`,
      subject,
      chapter,
      topic,
      studentLevel,
      difficulty_level: studentLevel === 'Weak' ? 'Beginner' : studentLevel === 'Strong' ? 'Advanced' : 'Intermediate',
      learning_objectives: [
        'Understand the structure, function, and purpose of the continuous (progressive) aspect',
        'Master the distinct rules of Present, Past, and Future Continuous tenses',
        'Identify stative verbs and avoid the common error of using them in continuous forms',
        'Apply orthographic rules accurately when forming present participles (-ing)'
      ],
      subtopics,
      theory: `Welcome to today's personalized study session on **${topic}** from **${chapter}** (${subject}, Class ${classLevel} ${board}). The continuous (or progressive) aspect is essential for expressing actions in motion, setting narrative backgrounds, and communicating scheduled future plans with clarity and precision.`,
      theory_qa,
      questions,
      summary,
      practice_questions: practice,
      allocatedMinutes,
      source: 'curriculum_fallback',
      createdAt: new Date().toISOString()
    };
  }

  // --------------------------------------------------------------------------
  // 2. SCIENCE: CHEMICAL REACTIONS AND EQUATIONS
  // --------------------------------------------------------------------------
  if (sLower.includes('sci') && (cLower.includes('chemical') || tLower.includes('reaction') || tLower.includes('equation'))) {
    const subtopics: AdaptiveSubtopic[] = [
      {
        id: 'sub_1',
        title: '1. What is a Chemical Reaction?',
        explanation: studentLevel === 'Weak'
          ? 'A chemical reaction happens when one or more substances change into entirely new substances with different properties. For example, when milk turns into curd or iron rusts in moist air, chemical bonds break and new bonds form.'
          : 'A chemical reaction is a process in which one or more substances (reactants) undergo chemical transformation through the breaking and making of chemical bonds to form new substances (products) with distinctly different chemical and physical properties.',
        formulaOrRule: 'Reactants (Starting Substances) → Products (New Substances Formed)',
        intuition: 'Atoms do not appear or vanish; they simply rearrange their partner bonds.',
        example: 'Magnesium ribbon burns in oxygen with a dazzling white flame to form white magnesium oxide powder: 2Mg + O₂ → 2MgO.',
        commonMistake: 'Confusing physical changes (melting ice) with chemical changes (burning candle wax).',
        importantPoints: [
          'Signs of reaction: change in state, color, temperature, or evolution of gas',
          'Accompanied by chemical bond reorganization',
          'Formation of new chemical identities'
        ]
      },
      {
        id: 'sub_2',
        title: '2. Balancing Chemical Equations & Conservation of Mass',
        explanation: 'According to the Law of Conservation of Mass, matter can neither be created nor destroyed in a chemical reaction. Therefore, the total number of atoms of each element must remain exactly equal on both sides of the arrow.',
        formulaOrRule: 'Total Mass of Reactants = Total Mass of Products  |  Number of atoms of element X on LHS = Number on RHS',
        intuition: 'Balance by adjusting coefficients in front of formulas, NEVER by changing subscripts in chemical formulas.',
        example: 'Unbalanced: Fe + H₂O → Fe₃O₄ + H₂. Balanced: 3Fe + 4H₂O → Fe₃O₄ + 4H₂.',
        commonMistake: 'Changing formula subscripts: e.g. writing H₂O₂ to balance oxygen instead of putting 2 in front of H₂O.',
        importantPoints: [
          'Governed strictly by Law of Conservation of Mass (Antoine Lavoisier)',
          'Only alter stoichiometric coefficients',
          'Include physical states: (s), (l), (g), (aq)'
        ]
      },
      {
        id: 'sub_3',
        title: '3. Combination Reactions (Synthesis)',
        explanation: 'A reaction in which two or more reactants combine together to form a single product.',
        formulaOrRule: 'A + B → AB',
        intuition: 'Multiple smaller building blocks fuse into one single compound.',
        example: 'Quicklime reacts vigorously with water to form slaked lime: CaO(s) + H₂O(l) → Ca(OH)₂(aq) + Heat.',
        commonMistake: 'Thinking all combination reactions are endothermic; most combination reactions are highly exothermic.',
        importantPoints: [
          'Single product formed',
          'Often releases substantial heat (exothermic)',
          'Slaked lime is used for whitewashing walls'
        ]
      },
      {
        id: 'sub_4',
        title: '4. Decomposition Reactions: Thermal, Electrolytic, Photochemical',
        explanation: 'A reaction in which a single compound breaks down into two or more simpler substances upon the absorption of energy (heat, light, or electricity).',
        formulaOrRule: 'AB + Energy → A + B',
        intuition: 'Opposite of combination; requires energy input to sever chemical bonds.',
        example: 'Thermal: 2FeSO₄(s) --Δ--> Fe₂O₃(s) + SO₂(g) + SO₃(g). Photochemical: 2AgCl(s) --Sunlight--> 2Ag(s) + Cl₂(g).',
        commonMistake: 'Forgetting that silver chloride turns grey in sunlight because elemental silver is liberated.',
        importantPoints: [
          'Thermal decomposition uses heat (Δ)',
          'Electrolysis of water produces H₂ and O₂ in a 2:1 volume ratio',
          'AgBr and AgCl decomposition used in black and white photography'
        ]
      },
      {
        id: 'sub_5',
        title: '5. Displacement & Double Displacement Reactions',
        explanation: 'In displacement, a more reactive element displaces a less reactive element from its aqueous salt solution. In double displacement, mutual exchange of ions between two ionic compounds occurs, typically forming an insoluble precipitate.',
        formulaOrRule: 'Displacement: A + BC → AC + B  |  Double Displacement: AB + CD → AD + CB',
        intuition: 'Displacement follows the reactivity series (K > Na > Ca > Mg > Al > Zn > Fe > Pb > H > Cu > Ag > Au).',
        example: 'Displacement: Fe + CuSO₄(blue) → FeSO₄(pale green) + Cu(reddish-brown). Double: Na₂SO₄(aq) + BaCl₂(aq) → BaSO₄(white ppt ↓) + 2NaCl(aq).',
        commonMistake: 'Assuming copper can displace iron from FeSO₄. Copper is less reactive than iron, so no reaction occurs.',
        importantPoints: [
          'Displacement governed by Reactivity Series',
          'Double displacement produces a precipitate (Precipitation Reaction)',
          'Barium sulphate (BaSO₄) is a prominent white precipitate'
        ]
      },
      {
        id: 'sub_6',
        title: '6. Oxidation, Reduction & Redox Reactions',
        explanation: 'Oxidation is the gain of oxygen or loss of hydrogen/electrons. Reduction is the loss of oxygen or gain of hydrogen/electrons. Reactions where oxidation and reduction occur simultaneously are called redox reactions.',
        formulaOrRule: 'Oxidation = Gain of O / Loss of H  |  Reduction = Loss of O / Gain of H',
        intuition: 'One substance cannot lose oxygen unless another substance is there to capture it.',
        example: 'CuO + H₂ → Cu + H₂O. CuO is reduced to Cu (loss of oxygen). H₂ is oxidized to H₂O (gain of oxygen). CuO is oxidizing agent; H₂ is reducing agent.',
        commonMistake: 'Confusing the substance oxidized with the oxidizing agent: the substance that gets reduced acts as the oxidizing agent.',
        importantPoints: [
          'Oxidation and reduction are complementary',
          'Oxidizing agent causes oxidation by getting reduced itself',
          'Reducing agent causes reduction by getting oxidized itself'
        ]
      },
      {
        id: 'sub_7',
        title: '7. Effects of Oxidation in Everyday Life: Corrosion & Rancidity',
        explanation: 'Corrosion is the slow deterioration of metals by air, moisture, and acids (e.g. rusting of iron forming hydrated ferric oxide Fe₂O₃·xH₂O). Rancidity is the aerial oxidation of fats and oils in food, causing foul taste and odor.',
        formulaOrRule: 'Rust: 4Fe + 3O₂ + 2xH₂O → 2Fe₂O₃·xH₂O  |  Prevention: Galvanization, painting, nitrogen gas packaging',
        intuition: 'Atmospheric oxygen chemically degrades metals and spoils unsaturated fatty food bonds.',
        example: 'Potato chip bags are flushed with unreactive nitrogen gas (N₂) to prevent aerial oxidation.',
        commonMistake: 'Thinking corrosion only happens to iron; silver tarnishes black (Ag₂S) and copper develops green coating (CuCO₃·Cu(OH)₂).',
        importantPoints: [
          'Iron rust is reddish-brown hydrated iron(III) oxide',
          'Copper corrosion produces basic copper carbonate (green patina)',
          'Antioxidants and nitrogen flushing prevent food rancidity'
        ]
      }
    ];

    const theory_qa: AdaptiveTheoryReviewQuestion[] = [
      {
        id: 'tqa_1',
        question: 'Why is it mandatory to balance every chemical equation in scientific chemistry?',
        theoreticalAnswer: 'A chemical equation must be balanced to satisfy the Law of Conservation of Mass, formulated by Antoine Lavoisier. The law states that matter can neither be created nor destroyed in a chemical reaction. Therefore, the total mass of the reactants must equal the total mass of the products, which requires the number of atoms of each individual element to remain identical on both sides of the equation.',
        keyPoints: ['Law of Conservation of Mass', 'Total mass of reactants = Total mass of products', 'Atoms are rearranged, not created or destroyed'],
        boardMarkingTip: 'State the name of the Law of Conservation of Mass and explicitly define its core premise.'
      },
      {
        id: 'tqa_2',
        question: 'What observations indicate that a chemical reaction has taken place during a laboratory experiment?',
        theoreticalAnswer: 'A chemical reaction is confirmed by one or more of the following four physical observations: 1) Evolution of a gas (e.g., zinc reacting with dilute H₂SO₄ liberating H₂ gas); 2) Change in temperature (exothermic heat release or endothermic cooling); 3) Change in color (e.g., blue copper sulphate turning pale green when iron nails are added); 4) Formation of an insoluble precipitate (e.g., white BaSO₄ forming when barium chloride meets sodium sulphate).',
        keyPoints: ['Evolution of gas', 'Change in temperature', 'Change in color', 'Formation of precipitate'],
        boardMarkingTip: 'List all four standard CBSE observations with at least one representative chemical reaction.'
      },
      {
        id: 'tqa_3',
        question: 'Distinguish between a displacement reaction and a double displacement reaction with balanced chemical equations.',
        theoreticalAnswer: 'In a single displacement reaction, a more reactive element displaces a less reactive element from its aqueous salt solution (e.g., Fe(s) + CuSO₄(aq) → FeSO₄(aq) + Cu(s)). In a double displacement reaction, two compounds exchange their ions to form two entirely new compounds, typically producing an insoluble precipitate (e.g., Na₂SO₄(aq) + BaCl₂(aq) → BaSO₄(s)↓ + 2NaCl(aq)).',
        keyPoints: ['Displacement depends on reactivity series', 'Double displacement involves mutual ion exchange', 'Include balanced equations with state symbols'],
        boardMarkingTip: 'Clearly highlight that displacement is governed by reactivity series, while double displacement involves ion exchange.'
      },
      {
        id: 'tqa_4',
        question: 'Define redox reaction. In the reaction MnO₂ + 4HCl → MnCl₂ + 2H₂O + Cl₂, identify the substance oxidized, reduced, oxidizing agent, and reducing agent.',
        theoreticalAnswer: 'A redox reaction is a chemical process where oxidation (loss of hydrogen/electrons or gain of oxygen) and reduction (gain of hydrogen/electrons or loss of oxygen) occur simultaneously. In MnO₂ + 4HCl → MnCl₂ + 2H₂O + Cl₂: 1) HCl loses hydrogen to form Cl₂, so HCl is oxidized; 2) MnO₂ loses oxygen to form MnCl₂, so MnO₂ is reduced; 3) MnO₂ is the oxidizing agent (it oxidizes HCl); 4) HCl is the reducing agent (it reduces MnO₂).',
        keyPoints: ['Simultaneous oxidation and reduction', 'Substance oxidized: HCl', 'Substance reduced: MnO₂', 'Oxidizing agent: MnO₂, Reducing agent: HCl'],
        boardMarkingTip: 'Tabulate or list all four required identifications clearly for full board marks.'
      },
      {
        id: 'tqa_5',
        question: 'Explain what rancidity is and describe two effective methods used commercially to prevent it.',
        theoreticalAnswer: 'Rancidity is the slow aerial oxidation of fats and oils present in food materials, resulting in the generation of volatile foul-smelling compounds and an unpleasant taste. Commercial prevention methods include: 1) Packaging food products in sealed bags flushed with inert gases like nitrogen (N₂) to prevent contact with atmospheric oxygen; 2) Adding synthetic or natural antioxidants (such as BHA or BHT) which preferentially react with oxygen, preserving the food fat.',
        keyPoints: ['Oxidation of fats and oils', 'Causes foul smell and taste', 'Flushing with nitrogen gas', 'Addition of antioxidants or refrigeration'],
        boardMarkingTip: 'Define rancidity explicitly in terms of oxidation of fats/oils and name nitrogen packaging as a key preventive measure.'
      }
    ];

    const summary = [
      'Chemical reactions involve chemical bond breaking and making, forming new substances with different properties.',
      'Equations must be balanced to satisfy the Law of Conservation of Mass (atoms on LHS = atoms on RHS).',
      'Combination reactions fuse multiple reactants into a single product (often exothermic).',
      'Decomposition reactions break a single compound into multiple products via heat, light, or electricity.',
      'Displacement follows the reactivity series; double displacement involves mutual ion exchange forming precipitates.',
      'Redox reactions feature simultaneous oxidation (gain of O / loss of H) and reduction (loss of O / gain of H).',
      'Corrosion and rancidity are everyday oxidation effects prevented by galvanization, antioxidants, and inert gas packaging.'
    ];

    const questions: AdaptiveTheoryQuestion[] = [
      {
        id: 'q_th_1',
        question: 'Why should a magnesium ribbon be cleaned with sandpaper before burning in air?',
        difficulty: 'easy',
        options: [
          'To remove the protective layer of basic magnesium carbonate from its surface.',
          'To make the ribbon thinner so it melts faster.',
          'To remove moisture accumulated from the air.',
          'To prevent the formation of magnesium oxide.'
        ],
        correctOptionIndex: 0,
        answer: 'To remove the protective layer of basic magnesium carbonate from its surface.',
        explanation: 'Magnesium reacts slowly with atmospheric gases to form a stable protective coating of basic magnesium carbonate, which prevents effective ignition. Cleaning with sandpaper exposes pure magnesium metal.',
        conceptTested: 'Experimental Chemistry Observations'
      },
      {
        id: 'q_th_2',
        question: 'Which law forms the foundation for balancing chemical equations?',
        difficulty: 'easy',
        options: [
          'Law of Conservation of Mass',
          'Law of Constant Proportions',
          'Law of Multiple Proportions',
          'Avogadro’s Law'
        ],
        correctOptionIndex: 0,
        answer: 'Law of Conservation of Mass',
        explanation: 'The Law of Conservation of Mass states that mass cannot be created or destroyed in a chemical reaction, meaning the total number of atoms of each element must remain constant.',
        conceptTested: 'Conservation of Mass'
      },
      {
        id: 'q_th_3',
        question: 'What is observed when quicklime (CaO) is added to water in a beaker?',
        difficulty: 'easy',
        options: [
          'A vigorous reaction occurs with evolution of large amounts of heat (exothermic).',
          'The beaker becomes freezing cold (endothermic).',
          'A reddish-brown gas is evolved immediately.',
          'No reaction occurs and CaO settles unchanged at the bottom.'
        ],
        correctOptionIndex: 0,
        answer: 'A vigorous reaction occurs with evolution of large amounts of heat (exothermic).',
        explanation: 'CaO + H₂O → Ca(OH)₂ + Heat. This combination reaction is vigorously exothermic, forming slaked lime.',
        conceptTested: 'Combination Reactions'
      },
      {
        id: 'q_th_4',
        question: 'What are the stoichiometric coefficients a, b, c, d to balance: aFe + bH₂O → cFe₃O₄ + dH₂?',
        difficulty: 'moderate',
        options: [
          'a = 3, b = 4, c = 1, d = 4',
          'a = 1, b = 2, c = 1, d = 2',
          'a = 3, b = 2, c = 1, d = 3',
          'a = 2, b = 4, c = 2, d = 4'
        ],
        correctOptionIndex: 0,
        answer: 'a = 3, b = 4, c = 1, d = 4',
        explanation: 'Balancing: 3Fe on LHS gives Fe₃ on RHS. 4H₂O provides 4 oxygen atoms for Fe₃O₄ and produces 4H₂ (8 hydrogen atoms). Thus, 3Fe + 4H₂O → Fe₃O₄ + 4H₂.',
        conceptTested: 'Balancing Chemical Equations'
      },
      {
        id: 'q_th_5',
        question: 'When white silver chloride (AgCl) is exposed to sunlight, it turns grey. This is an example of:',
        difficulty: 'moderate',
        options: [
          'Photochemical decomposition reaction',
          'Thermal decomposition reaction',
          'Combination reaction',
          'Displacement reaction'
        ],
        correctOptionIndex: 0,
        answer: 'Photochemical decomposition reaction',
        explanation: '2AgCl(s) --Sunlight--> 2Ag(s) + Cl₂(g). Sunlight supplies photon energy to break down white AgCl into grey metallic silver and chlorine gas.',
        conceptTested: 'Decomposition Reactions'
      },
      {
        id: 'q_th_6',
        question: 'An iron nail is immersed in blue copper sulphate solution. After 30 minutes, what changes occur in the beaker?',
        difficulty: 'moderate',
        options: [
          'The solution turns pale green and reddish-brown copper deposits on the iron nail.',
          'The solution becomes deep blue and the nail dissolves completely.',
          'The solution turns colorless and white precipitate settles.',
          'No visible change takes place because iron is less reactive than copper.'
        ],
        correctOptionIndex: 0,
        answer: 'The solution turns pale green and reddish-brown copper deposits on the iron nail.',
        explanation: 'Fe + CuSO₄(blue) → FeSO₄(pale green) + Cu(reddish-brown). Iron displaces copper because iron is higher in the reactivity series.',
        conceptTested: 'Displacement Reactions'
      },
      {
        id: 'q_th_7',
        question: 'Identify the precipitate formed when sodium sulphate solution is mixed with barium chloride solution:',
        difficulty: 'easy',
        options: [
          'Barium sulphate (BaSO₄), white precipitate',
          'Sodium chloride (NaCl), yellow precipitate',
          'Barium sulphide (BaS), black precipitate',
          'Sodium oxide (Na₂O), white precipitate'
        ],
        correctOptionIndex: 0,
        answer: 'Barium sulphate (BaSO₄), white precipitate',
        explanation: 'Na₂SO₄(aq) + BaCl₂(aq) → BaSO₄(s)↓ + 2NaCl(aq). BaSO₄ is an insoluble white precipitate.',
        conceptTested: 'Precipitation & Double Displacement'
      },
      {
        id: 'q_th_8',
        question: 'In the reaction: CuO + H₂ → Cu + H₂O, which substance acts as the REDUCING AGENT?',
        difficulty: 'moderate',
        options: ['H₂', 'CuO', 'Cu', 'H₂O'],
        correctOptionIndex: 0,
        answer: 'H₂',
        explanation: 'H₂ gains oxygen to form H₂O (it gets oxidized). The substance that undergoes oxidation acts as the reducing agent.',
        conceptTested: 'Redox Agents'
      },
      {
        id: 'q_th_9',
        question: 'During the electrolysis of acidified water, what is the volume ratio of hydrogen gas collected at the cathode to oxygen gas at the anode?',
        difficulty: 'hard',
        options: ['2 : 1', '1 : 2', '1 : 1', '8 : 1'],
        correctOptionIndex: 0,
        answer: '2 : 1',
        explanation: '2H₂O(l) --Electricity--> 2H₂(g) + O₂(g). The stoichiometry produces 2 moles of H₂ gas for every 1 mole of O₂ gas, giving a 2:1 volume ratio.',
        conceptTested: 'Electrolytic Decomposition Stoichiometry'
      },
      {
        id: 'q_th_10',
        question: 'Why are nitrogen gas flushes used when packaging commercial potato chips?',
        difficulty: 'hard',
        options: [
          'To create an inert atmosphere that prevents oxidation and rancidity of oils.',
          'To make the chips absorb moisture and soften.',
          'To bleach the chips white using chemical reduction.',
          'To increase the acidity and prevent fungal growth.'
        ],
        correctOptionIndex: 0,
        answer: 'To create an inert atmosphere that prevents oxidation and rancidity of oils.',
        explanation: 'Nitrogen (N₂) is an unreactive inert gas that replaces atmospheric oxygen, preventing the oxidative decomposition of fats and oils (rancidity).',
        conceptTested: 'Rancidity Prevention'
      }
    ];

    const practice: AdaptivePracticeQuestion[] = [
      {
        id: 'q_pr_1',
        question: 'Translate and balance: Hydrogen gas combines with nitrogen to form ammonia.',
        difficulty: 'easy',
        options: [
          '3H₂ + N₂ → 2NH₃',
          'H₂ + N₂ → NH₃',
          '2H₂ + N₂ → 2NH₃',
          '3H₂ + 2N₂ → 2NH₃'
        ],
        correctOptionIndex: 0,
        answer: '3H₂ + N₂ → 2NH₃',
        explanation: 'Hydrogen exists as H₂ and nitrogen as N₂. Balancing gives 3H₂ + N₂ → 2NH₃ (6 hydrogen and 2 nitrogen atoms on each side).',
        hint: 'Remember that hydrogen and nitrogen are diatomic molecules (H₂ and N₂).'
      },
      {
        id: 'q_pr_2',
        question: 'Which of the following is an ENDOTHERMIC reaction?',
        difficulty: 'moderate',
        options: [
          'Decomposition of calcium carbonate (CaCO₃ → CaO + CO₂)',
          'Respiration process in living cells',
          'Burning of natural gas (methane)',
          'Reaction of quicklime with water'
        ],
        correctOptionIndex: 0,
        answer: 'Decomposition of calcium carbonate (CaCO₃ → CaO + CO₂)',
        explanation: 'Thermal decomposition of CaCO₃ requires continuous absorption of heat energy, making it endothermic. Respiration and combustion release heat (exothermic).',
        hint: 'Endothermic reactions absorb heat energy to proceed.'
      },
      {
        id: 'q_pr_3',
        question: 'What gas is evolved when zinc granules react with dilute sulphuric acid, and how is it tested?',
        difficulty: 'easy',
        options: [
          'Hydrogen gas; burns with a pop sound when a burning splinter is brought near.',
          'Oxygen gas; rekindles a glowing splint.',
          'Carbon dioxide gas; turns lime water milky.',
          'Sulphur dioxide gas; smells of burning sulphur.'
        ],
        correctOptionIndex: 0,
        answer: 'Hydrogen gas; burns with a pop sound when a burning splinter is brought near.',
        explanation: 'Zn + H₂SO₄ → ZnSO₄ + H₂↑. Hydrogen gas is flammable and burns with a characteristic "pop" sound.',
        hint: 'Acids reacting with reactive metals liberate hydrogen gas.'
      },
      {
        id: 'q_pr_4',
        question: 'Identify the oxidizing agent in: 2PbO + C → 2Pb + CO₂.',
        difficulty: 'moderate',
        options: ['PbO', 'C', 'Pb', 'CO₂'],
        correctOptionIndex: 0,
        answer: 'PbO',
        explanation: 'PbO loses oxygen to become Pb (it is reduced). The substance reduced is the oxidizing agent.',
        hint: 'The oxidizing agent is the substance that provides oxygen.'
      },
      {
        id: 'q_pr_5',
        question: 'Which green compound forms on copper objects exposed to moist air over time?',
        difficulty: 'hard',
        options: [
          'Basic copper carbonate [CuCO₃·Cu(OH)₂]',
          'Copper(II) oxide [CuO]',
          'Copper sulphate [CuSO₄]',
          'Copper chloride [CuCl₂]'
        ],
        correctOptionIndex: 0,
        answer: 'Basic copper carbonate [CuCO₃·Cu(OH)₂]',
        explanation: 'Copper reacts with atmospheric CO₂, O₂, and moisture to develop a green coating of basic copper carbonate.',
        hint: 'The green patina contains both carbonate and hydroxide ions of copper.'
      }
    ];

    return {
      id: `lesson_sci_${topic.toLowerCase()}_${Date.now()}`,
      subject,
      chapter,
      topic,
      studentLevel,
      difficulty_level: studentLevel === 'Weak' ? 'Beginner' : studentLevel === 'Strong' ? 'Advanced' : 'Intermediate',
      learning_objectives: [
        'Understand chemical reactions, reactants, products, and characteristics of chemical change',
        'Master the step-by-step method of balancing chemical equations using the Law of Conservation of Mass',
        'Classify reactions into combination, decomposition, displacement, double displacement, and redox',
        'Identify practical effects of oxidation including corrosion and rancidity'
      ],
      subtopics,
      theory: `Welcome to today's personalized study session on **${topic}** from **${chapter}** (${subject}, Class ${classLevel} ${board}). Chemical reactions are the foundation of chemical transformations, governing how matter changes form, produces energy, and recombines into novel materials.`,
      theory_qa,
      questions,
      summary,
      practice_questions: practice,
      allocatedMinutes,
      source: 'curriculum_fallback',
      createdAt: new Date().toISOString()
    };
  }

  // --------------------------------------------------------------------------
  // 3. MATHEMATICS: QUADRATIC EQUATIONS / NATURE OF ROOTS
  // --------------------------------------------------------------------------
  if (sLower.includes('math') || tLower.includes('root') || cLower.includes('quadratic')) {
    const subtopics: AdaptiveSubtopic[] = [
      {
        id: 'sub_1',
        title: '1. Meaning of Roots in Quadratic Equations',
        explanation: studentLevel === 'Weak'
          ? 'The roots of a quadratic equation are the values of x that make the equation ax² + bx + c = 0 equal to zero. In graphical terms, they are the points where the parabola crosses or touches the x-axis.'
          : 'The roots (or zeros) of ax² + bx + c = 0 (a ≠ 0) represent the x-coordinates of the intersection points of the parabola y = ax² + bx + c with the horizontal x-axis. A quadratic equation always has exactly two roots over complex numbers.',
        formulaOrRule: 'ax² + bx + c = 0, where a ≠ 0 and a, b, c ∈ ℝ',
        intuition: 'Think of roots as the ground landing points of a parabolic trajectory.',
        example: 'For x² - 5x + 6 = 0, the roots are x = 2 and x = 3 because (2)² - 5(2) + 6 = 0 and (3)² - 5(3) + 6 = 0.',
        commonMistake: 'Forgetting that a quadratic equation always has 2 roots (which may be identical or non-real).',
        importantPoints: ['Roots satisfy the equation', 'Graphically correspond to x-intercepts', 'Determined by coefficients a, b, c']
      },
      {
        id: 'sub_2',
        title: '2. The Discriminant (D = b² - 4ac)',
        explanation: 'The discriminant is the expression inside the square root of the quadratic formula x = (-b ± √(b² - 4ac)) / (2a). It determines what kind of roots will emerge without needing to solve the entire equation.',
        formulaOrRule: 'D = b² - 4ac',
        intuition: 'Because D sits under a square root, its sign (positive, zero, or negative) dictates whether you get two real numbers, one repeated real number, or non-real numbers.',
        example: 'In 2x² - 4x + 3 = 0: a = 2, b = -4, c = 3. D = (-4)² - 4(2)(3) = 16 - 24 = -8.',
        commonMistake: 'Writing D = b² + 4ac or forgetting to square the negative sign in (-b)², e.g., writing -4² = -16 instead of 16.',
        importantPoints: ['D > 0: Two distinct real roots', 'D = 0: Two equal real roots', 'D < 0: No real roots']
      },
      {
        id: 'sub_3',
        title: '3. Condition for Real and Distinct Roots (D > 0)',
        explanation: 'When the discriminant D is strictly positive (D > 0), the term √(D) is a positive real number. Adding and subtracting this non-zero value gives two distinctly different real answers.',
        formulaOrRule: 'b² - 4ac > 0 ⇒ Roots: x = (-b + √D) / 2a and x = (-b - √D) / 2a',
        intuition: 'Adding a positive number gives one point, subtracting it gives another point separated on the number line.',
        example: 'In x² - 4x + 3 = 0, D = (-4)² - 4(1)(3) = 16 - 12 = 4 > 0. Roots are x = (4 ± 2)/2 ⇒ x = 3, 1 (two distinct real roots).',
        commonMistake: 'Assuming distinct roots only occur when D is a perfect square. Even if D = 5, the roots are real and distinct (irrational).',
        importantPoints: ['Parabola crosses x-axis at two distinct points', 'If coefficients are rational and D is a perfect square, roots are rational', 'If D is not a perfect square, roots form conjugate irrational pairs']
      },
      {
        id: 'sub_4',
        title: '4. Condition for Real and Equal Roots (D = 0)',
        explanation: 'When D = 0, the term √(0) = 0. Adding or subtracting zero produces the exact same value (-b / 2a). Thus, the quadratic has two coincident (repeated) real roots.',
        formulaOrRule: 'b² - 4ac = 0 ⇒ x = -b / (2a)',
        intuition: 'The two roots merge into a single point of tangency on the x-axis.',
        example: 'For x² - 6x + 9 = 0, D = (-6)² - 4(1)(9) = 36 - 36 = 0. The root is x = 6/2 = 3 (repeated).',
        commonMistake: 'Saying "only one root exists". In CBSE, state "two equal real roots" or "coincident roots".',
        importantPoints: ['The quadratic expression is a perfect square', 'Vertex of the parabola lies directly on the x-axis', 'Crucial in exam problems asking "Find k such that roots are equal"']
      },
      {
        id: 'sub_5',
        title: '5. Condition for No Real Roots (D < 0)',
        explanation: 'When D < 0, calculating √(D) requires taking the square root of a negative quantity, which does not exist in the set of real numbers ℝ. Hence, there are no real roots (the roots are complex conjugates).',
        formulaOrRule: 'b² - 4ac < 0 ⇒ No real roots (roots ∈ ℂ)',
        intuition: 'The parabola turns around before ever reaching the x-axis; it floats entirely above or below the horizontal axis.',
        example: 'For x² + x + 2 = 0, D = (1)² - 4(1)(2) = 1 - 8 = -7 < 0. No real roots exist.',
        commonMistake: 'Claiming the equation has "no solutions at all". It has solutions in complex numbers, but "no real roots".',
        importantPoints: ['Graph never touches or crosses the x-axis', 'For a > 0, ax² + bx + c > 0 for all real x', 'Square root of a negative number is non-real']
      },
      {
        id: 'sub_6',
        title: '6. Relationship Between Roots and Coefficients',
        explanation: 'If α and β are the two roots of ax² + bx + c = 0, their sum and product are directly tied to the coefficients a, b, and c without needing to find the individual roots.',
        formulaOrRule: 'Sum of roots: α + β = -b / a  |  Product of roots: α · β = c / a',
        intuition: 'Expanding a(x - α)(x - β) = ax² - a(α + β)x + aαβ demonstrates coefficient equivalence immediately.',
        example: 'For 3x² - 9x + 6 = 0: Sum = -(-9)/3 = 3. Product = 6/3 = 2. Verify with roots 1 and 2: 1 + 2 = 3, 1 · 2 = 2.',
        commonMistake: 'Forgetting the negative sign in the sum formula: writing b/a instead of -b/a.',
        importantPoints: ['α + β = -b/a', 'αβ = c/a', 'Equation can be reconstructed as x² - (α + β)x + αβ = 0']
      },
      {
        id: 'sub_7',
        title: '7. Graphical Interpretation of Discriminant',
        explanation: 'The discriminant geometrically classifies the parabola y = ax² + bx + c relative to the horizontal x-axis.',
        formulaOrRule: 'D > 0: 2 x-intercepts | D = 0: 1 x-intercept (tangent) | D < 0: 0 x-intercepts',
        intuition: 'The discriminant acts like a vertical height detector for the vertex relative to the x-axis.',
        example: 'If a > 0 and D < 0, the entire parabola lies strictly above the x-axis, meaning y > 0 for every real x.',
        commonMistake: 'Confusing the y-intercept (which is c) with the roots (which are x-intercepts).',
        importantPoints: ['D > 0: Secant intersection at two distinct points', 'D = 0: Tangent touch at vertex (-b/2a, 0)', 'D < 0: Zero intersection, entire curve is on one side of x-axis']
      }
    ];

    const theory_qa: AdaptiveTheoryReviewQuestion[] = [
      {
        id: 'tqa_1',
        question: 'Define the discriminant of a quadratic equation ax² + bx + c = 0 and explain how it determines the nature of roots.',
        theoreticalAnswer: 'The discriminant (D) is the algebraic expression D = b² - 4ac found under the radical sign in the quadratic formula x = (-b ± √D) / 2a. The sign of D dictates the nature of the roots: 1) If D > 0, the equation has two distinct real roots; 2) If D = 0, the equation has two equal (coincident) real roots given by x = -b / 2a; 3) If D < 0, the equation has no real roots because the square root of a negative quantity is not real.',
        keyPoints: ['D = b² - 4ac', 'D > 0: 2 distinct real roots', 'D = 0: 2 equal real roots', 'D < 0: No real roots'],
        boardMarkingTip: 'State the formula D = b² - 4ac and list all three conditions with the exact terminology used by CBSE.'
      },
      {
        id: 'tqa_2',
        question: 'Explain why a quadratic equation with real coefficients cannot have exactly one real root.',
        theoreticalAnswer: 'According to the Fundamental Theorem of Algebra, any polynomial equation of degree 2 must have exactly two roots. When the discriminant D = 0, the two roots do not disappear; rather, they coincide at the exact same numeric value x = -b / (2a). Hence, we state that the equation has "two equal real roots" rather than only one root. When D < 0, the roots occur in non-real complex conjugate pairs, never leaving a single isolated real root.',
        keyPoints: ['Degree 2 requires 2 roots', 'D = 0 produces coincident/repeated roots', 'Complex roots always occur in pairs'],
        boardMarkingTip: 'Emphasize that the roots are "two coincident real roots" rather than "one root".'
      },
      {
        id: 'tqa_3',
        question: 'What is the relationship between the coefficients of ax² + bx + c = 0 and its roots α and β? How can an equation be formed from its roots?',
        theoreticalAnswer: 'If α and β are roots of ax² + bx + c = 0, then: 1) Sum of roots α + β = -b / a; 2) Product of roots αβ = c / a. Conversely, if the sum (S) and product (P) of the roots are given, the quadratic equation can be formed as k[x² - (α + β)x + αβ] = 0, or x² - Sx + P = 0, where k ≠ 0 is a real constant.',
        keyPoints: ['Sum = -b/a', 'Product = c/a', 'Equation: x² - (Sum)x + Product = 0'],
        boardMarkingTip: 'Do not forget the negative sign before the sum of roots.'
      },
      {
        id: 'tqa_4',
        question: 'Describe the geometric/graphical interpretation of the quadratic function y = ax² + bx + c for D > 0, D = 0, and D < 0.',
        theoreticalAnswer: 'The graph of y = ax² + bx + c is a parabola opening upwards (if a > 0) or downwards (if a < 0). 1) For D > 0, the parabola intersects the x-axis at two distinct points corresponding to the real roots; 2) For D = 0, the vertex of the parabola touches the x-axis at exactly one point (tangent line); 3) For D < 0, the parabola does not touch or intersect the x-axis at all, lying entirely above (if a > 0) or below (if a < 0) the x-axis.',
        keyPoints: ['D > 0: 2 x-intercepts', 'D = 0: 1 tangent point of contact at vertex', 'D < 0: No intersection with x-axis'],
        boardMarkingTip: 'Mention the relationship between x-intercepts and the roots of the equation.'
      },
      {
        id: 'tqa_5',
        question: 'Under what conditions do the roots of ax² + bx + c = 0 become rational numbers (assuming a, b, c are rational)?',
        theoreticalAnswer: 'The roots x = (-b ± √D) / 2a are rational if and only if the discriminant D = b² - 4ac is a perfect square of a rational number (and D ≥ 0). If D is positive but not a perfect square, √D is an irrational number, which makes both roots real, distinct, and irrational (forming conjugate surds of the form p ± √q).',
        keyPoints: ['D must be a perfect square for rational roots', 'Non-perfect square positive D produces conjugate irrational roots', 'D = 0 gives rational equal roots'],
        boardMarkingTip: 'Explicitly state the "perfect square" condition for rationality.'
      }
    ];

    const summary = [
      'The discriminant D = b² - 4ac completely determines the nature of roots of ax² + bx + c = 0.',
      'D > 0 produces two distinct real roots (parabola crosses x-axis twice).',
      'D = 0 produces two equal real roots x = -b / 2a (parabola touches x-axis at vertex).',
      'D < 0 produces no real roots (parabola floats entirely above or below x-axis).',
      'For equal roots exam problems, set D = b² - 4ac = 0 and solve for the unknown parameter.',
      'Sum of roots α + β = -b / a and Product of roots αβ = c / a.'
    ];

    const questions: AdaptiveTheoryQuestion[] = [
      {
        id: 'q_th_1',
        question: 'What is the formula for the discriminant (D) of the quadratic equation ax² + bx + c = 0?',
        difficulty: 'easy',
        options: ['D = b² - 4ac', 'D = b² + 4ac', 'D = 4ac - b²', 'D = -b ± √(b² - 4ac)'],
        correctOptionIndex: 0,
        answer: 'D = b² - 4ac',
        explanation: 'The discriminant is defined as D = b² - 4ac, which is the expression under the radical sign in the quadratic formula.',
        conceptTested: 'Definition of Discriminant'
      },
      {
        id: 'q_th_2',
        question: 'If the discriminant D of a quadratic equation is equal to 0, what can be concluded about its roots?',
        difficulty: 'easy',
        options: ['Roots are real and distinct', 'Roots are real and equal', 'No real roots exist', 'Roots must both be equal to zero'],
        correctOptionIndex: 1,
        answer: 'Roots are real and equal',
        explanation: 'When D = 0, x = (-b ± 0) / 2a = -b / 2a. Both roots coincide and are equal real numbers.',
        conceptTested: 'Equal Roots Condition'
      },
      {
        id: 'q_th_3',
        question: 'Find the discriminant of the quadratic equation 2x² - 4x + 3 = 0.',
        difficulty: 'easy',
        options: ['-8', '8', '40', '-40'],
        correctOptionIndex: 0,
        answer: '-8',
        explanation: 'Here a = 2, b = -4, c = 3. D = b² - 4ac = (-4)² - 4(2)(3) = 16 - 24 = -8.',
        conceptTested: 'Discriminant Calculation'
      },
      {
        id: 'q_th_4',
        question: 'For what condition does the quadratic equation ax² + bx + c = 0 have two distinct real roots?',
        difficulty: 'easy',
        options: ['b² - 4ac > 0', 'b² - 4ac = 0', 'b² - 4ac < 0', 'b² - 4ac ≤ 0'],
        correctOptionIndex: 0,
        answer: 'b² - 4ac > 0',
        explanation: 'When b² - 4ac > 0, the square root produces a non-zero real number, resulting in two separate real roots.',
        conceptTested: 'Distinct Real Roots'
      },
      {
        id: 'q_th_5',
        question: 'For what value of k does the quadratic equation 2x² + kx + 3 = 0 have two equal real roots?',
        difficulty: 'moderate',
        options: ['k = ±2√6', 'k = ±4√3', 'k = ±6', 'k = 24'],
        correctOptionIndex: 0,
        answer: 'k = ±2√6',
        explanation: 'For equal roots, D = 0. b² - 4ac = 0 ⇒ k² - 4(2)(3) = 0 ⇒ k² - 24 = 0 ⇒ k² = 24 ⇒ k = ±√24 = ±2√6.',
        conceptTested: 'Parameter Determination for Equal Roots'
      },
      {
        id: 'q_th_6',
        question: 'If the roots of ax² + bx + c = 0 are real and equal, which of the following expressions is always true?',
        difficulty: 'moderate',
        options: ['b² = 4ac', 'b = 2ac', 'c = b / (4a)', 'b² = -4ac'],
        correctOptionIndex: 0,
        answer: 'b² = 4ac',
        explanation: 'D = 0 implies b² - 4ac = 0, which directly gives b² = 4ac.',
        conceptTested: 'Algebraic Form of D = 0'
      },
      {
        id: 'q_th_7',
        question: 'If the graph of y = ax² + bx + c touches the x-axis at exactly one point, what is the value of D?',
        difficulty: 'moderate',
        options: ['D = 0', 'D > 0', 'D < 0', 'D cannot be determined'],
        correctOptionIndex: 0,
        answer: 'D = 0',
        explanation: 'A single point of contact with the x-axis means the curve is tangent to the axis, corresponding to two coincident real roots (D = 0).',
        conceptTested: 'Geometric Interpretation'
      },
      {
        id: 'q_th_8',
        question: 'If a, b, c are rational and D = b² - 4ac is positive but NOT a perfect square, what is the nature of the roots?',
        difficulty: 'moderate',
        options: ['Real, distinct, and irrational', 'Real, equal, and rational', 'Non-real complex numbers', 'Integer roots'],
        correctOptionIndex: 0,
        answer: 'Real, distinct, and irrational',
        explanation: 'Since D > 0, the roots are real and distinct. Because D is not a perfect square, √D is irrational, making both roots conjugate irrational numbers.',
        conceptTested: 'Rational vs Irrational Roots'
      },
      {
        id: 'q_th_9',
        question: 'The equation (k - 12)x² + 2(k - 12)x + 2 = 0 has equal roots. Given k ≠ 12, find the value of k.',
        difficulty: 'hard',
        options: ['k = 14', 'k = 12', 'k = 10', 'k = 16'],
        correctOptionIndex: 0,
        answer: 'k = 14',
        explanation: 'Here a = (k - 12), b = 2(k - 12), c = 2. For equal roots D = 0: [2(k - 12)]² - 4(k - 12)(2) = 0 ⇒ 4(k - 12)² - 8(k - 12) = 0 ⇒ 4(k - 12)[(k - 12) - 2] = 0. Since k ≠ 12, (k - 14) = 0 ⇒ k = 14.',
        conceptTested: 'Higher Order Quadratic Parameter Solving'
      },
      {
        id: 'q_th_10',
        question: 'If the equation x² + 2(k + 1)x + k² = 0 has real roots for all real values of k, what can be concluded about the roots?',
        difficulty: 'hard',
        options: ['Roots are real when k ≥ -1/2', 'Roots are real for all real k', 'Roots are never real', 'Roots are real only when k = 0'],
        correctOptionIndex: 0,
        answer: 'Roots are real when k ≥ -1/2',
        explanation: 'For real roots, D ≥ 0. D = [2(k + 1)]² - 4(1)(k²) = 4(k² + 2k + 1) - 4k² = 8k + 4 ≥ 0 ⇒ 8k ≥ -4 ⇒ k ≥ -1/2.',
        conceptTested: 'Inequality Constraints on Discriminant'
      }
    ];

    const practice: AdaptivePracticeQuestion[] = [
      {
        id: 'q_pr_1',
        question: 'Find the nature of the roots of the equation 3x² - 2x + 1/3 = 0.',
        difficulty: 'easy',
        options: ['Real and equal', 'Real and distinct', 'No real roots', 'Roots cannot be computed'],
        correctOptionIndex: 0,
        answer: 'Real and equal',
        explanation: 'a = 3, b = -2, c = 1/3. D = (-2)² - 4(3)(1/3) = 4 - 4 = 0. Hence the roots are real and equal.',
        hint: 'Calculate D = b² - 4ac carefully.'
      },
      {
        id: 'q_pr_2',
        question: 'Determine the value of p such that 4x² + px + 9 = 0 has equal roots.',
        difficulty: 'moderate',
        options: ['p = ±12', 'p = ±6', 'p = ±24', 'p = 144'],
        correctOptionIndex: 0,
        answer: 'p = ±12',
        explanation: 'For equal roots, D = 0. p² - 4(4)(9) = 0 ⇒ p² - 144 = 0 ⇒ p = ±12.',
        hint: 'Set b² - 4ac = 0 and remember to include both positive and negative square roots.'
      },
      {
        id: 'q_pr_3',
        question: 'Which of the following quadratic equations has no real roots?',
        difficulty: 'moderate',
        options: ['x² + 4x + 5 = 0', 'x² - 4x + 4 = 0', '2x² - 5x + 2 = 0', 'x² - 6x + 8 = 0'],
        correctOptionIndex: 0,
        answer: 'x² + 4x + 5 = 0',
        explanation: 'For x² + 4x + 5 = 0, D = (4)² - 4(1)(5) = 16 - 20 = -4 < 0, which means no real roots exist.',
        hint: 'Evaluate the sign of D for each option.'
      },
      {
        id: 'q_pr_4',
        question: 'If one root of the quadratic equation 2x² + kx - 6 = 0 is 2, what is the value of k and the other root?',
        difficulty: 'hard',
        options: ['k = -1, other root = -3/2', 'k = 1, other root = 3/2', 'k = -2, other root = -3', 'k = 4, other root = -1'],
        correctOptionIndex: 0,
        answer: 'k = -1, other root = -3/2',
        explanation: 'Substitute x = 2: 2(2)² + k(2) - 6 = 0 ⇒ 8 + 2k - 6 = 0 ⇒ 2k = -2 ⇒ k = -1. Product of roots αβ = c/a = -6/2 = -3. Since α = 2, β = -3/2.',
        hint: 'Substitute the given root into the equation to find k, then use the product of roots formula αβ = c/a.'
      },
      {
        id: 'q_pr_5',
        question: 'For what values of m does the equation (m + 1)x² - 2(m - 1)x + 1 = 0 have real and equal roots?',
        difficulty: 'hard',
        options: ['m = 0 or m = 3', 'm = 1 or m = -1', 'm = 2 or m = -2', 'm = 4 only'],
        correctOptionIndex: 0,
        answer: 'm = 0 or m = 3',
        explanation: 'D = [-2(m - 1)]² - 4(m + 1)(1) = 4(m² - 2m + 1) - 4m - 4 = 4m² - 8m + 4 - 4m - 4 = 4m² - 12m = 4m(m - 3). For equal roots D = 0 ⇒ 4m(m - 3) = 0 ⇒ m = 0 or m = 3.',
        hint: 'Carefully expand [-2(m - 1)]² and collect terms for 4m(m - 3) = 0.'
      }
    ];

    return {
      id: `lesson_math_${topic.toLowerCase()}_${Date.now()}`,
      subject,
      chapter,
      topic,
      studentLevel,
      difficulty_level: studentLevel === 'Weak' ? 'Beginner' : studentLevel === 'Strong' ? 'Advanced' : 'Intermediate',
      learning_objectives: [
        'Understand the definition of roots of a quadratic equation ax² + bx + c = 0',
        'Calculate and evaluate the discriminant D = b² - 4ac',
        'Identify the nature of roots based on the sign of the discriminant',
        'Apply the conditions of equal roots to solve unknown parameter problems in board exams'
      ],
      subtopics,
      theory: `Welcome to today's personalized study session on **${topic}** from **${chapter}** (${subject}, Class ${classLevel} ${board}). The discriminant is an algebraic diagnostic tool that reveals the geometrical and algebraic nature of quadratic roots.`,
      theory_qa,
      questions,
      summary,
      practice_questions: practice,
      allocatedMinutes,
      source: 'curriculum_fallback',
      createdAt: new Date().toISOString()
    };
  }

  // --------------------------------------------------------------------------
  // 4. GENERAL SUBJECT-AWARE DYNAMIC GENERATOR (Linguistic / Scientific / Humanities)
  // --------------------------------------------------------------------------
  const isLanguageSubject = sLower.includes('english') || sLower.includes('hindi') || sLower.includes('sanskrit');
  const isSocialScience = sLower.includes('social') || sLower.includes('history') || sLower.includes('civics') || sLower.includes('geo') || sLower.includes('pol');

  const subtopicTemplates: { title: string; explanation: string; formulaOrRule?: string; intuition?: string; example?: string; commonMistake?: string; importantPoints: string[] }[] = isLanguageSubject ? [
    {
      title: `1. Grammatical Framework & Core Rule of ${topic}`,
      explanation: studentLevel === 'Weak'
        ? `In ${subject}, ${topic} establishes how words combine into clear, coherent sentences. Learning the standard formula and word order helps avoid common communication mistakes.`
        : `${topic} is a vital grammatical and structural pillar in ${board} Class ${classLevel} ${subject}. It dictates how syntactic elements and sentence structures coordinate according to formal linguistic conventions.`,
      formulaOrRule: `Standard syntax rule governing ${topic} in Class ${classLevel}`,
      intuition: `Think of ${topic} as the blueprint determining word order and inflection in standard English.`,
      example: `An illustrative standard sentence demonstrating the application of ${topic}.`,
      commonMistake: `Subject-verb disagreement or inappropriate tense shift when applying ${topic}.`,
      importantPoints: [`Formal grammatical rule`, `Sentence structure pattern`, `Correct contextual usage`]
    },
    {
      title: `2. Structural Formulas & Sentence Patterns for ${topic}`,
      explanation: `Mastering positive, negative, and interrogative sentence patterns ensures accurate writing in board composition and editing questions.`,
      formulaOrRule: `Subject + Auxiliary + Main Verb Form + Complement / Object`,
      intuition: `Every sentence variation follows a predictable word-order sequence.`,
      example: `Transforming an affirmative sentence into negative and interrogative forms using ${topic}.`,
      commonMistake: `Misplacing auxiliary verbs or omitting necessary inflectional endings.`,
      importantPoints: [`Affirmative, negative, and question forms`, `Correct placement of adverbs`, `Punctuation rules`]
    },
    {
      title: `3. Key Exceptions, Irregularities & Stative Constraints`,
      explanation: `Linguistic rules often carry subtle exceptions. Recognizing which verbs or expressions deviate from standard patterns prevents frequent exam traps.`,
      formulaOrRule: `Exception guideline for irregular verbs and stative expressions`,
      intuition: `Irregularities reflect historical language development; memorize high-yield exceptions.`,
      example: `A high-yield irregular usage commonly tested in CBSE error correction.`,
      commonMistake: `Applying regular inflection rules to irregular or stative verbs.`,
      importantPoints: [`High-frequency irregular forms`, `Stative and non-progressive contexts`, `Concord edge cases`]
    },
    {
      title: `4. Contextual & Pragmatic Usage in Writing`,
      explanation: `Using ${topic} effectively elevates formal writing—such as analytical paragraphs, formal letters, and literary essays—by creating cohesion and tone.`,
      formulaOrRule: `Formal communication guideline incorporating ${topic}`,
      intuition: `Appropriate verb and grammatical choice communicates exact timeline and intent to the reader.`,
      example: `A sample paragraph excerpt demonstrating precise use of ${topic}.`,
      commonMistake: `Inconsistent grammatical shifts between sentences in a single paragraph.`,
      importantPoints: [`Tone and register consistency`, `Connecting sentences logically`, `Board writing assessment criteria`]
    },
    {
      title: `5. Common Board Exam Editing & Omission Patterns`,
      explanation: `CBSE Class ${classLevel} examination papers consistently feature editing passages that test subtle errors in ${topic}.`,
      formulaOrRule: `Proofreading checklist: inspect auxiliary agreement, tense consistency, and inflection`,
      intuition: `Read the entire sentence to identify whether the context requires past, present, or hypothetical framing.`,
      example: `An unedited passage line corrected by identifying the specific error in ${topic}.`,
      commonMistake: `Reading words in isolation rather than analyzing the whole sentence context.`,
      importantPoints: [`Error detection techniques`, `Subject-verb concord check`, `Contextual time-marker verification`]
    },
    {
      title: `6. High-Yield Practice Cases & Summary Analysis`,
      explanation: `Synthesizing today's grammatical rules enables confident performance across reading, writing, and grammar sections.`,
      formulaOrRule: `Integrated grammar resolution framework for ${topic}`,
      intuition: `Practice recognizing sentence patterns until error detection becomes second nature.`,
      example: `A 3-mark integrated gap-filling exercise solved with complete grammatical justification.`,
      commonMistake: `Rushing gap-filling without testing all multiple-choice options.`,
      importantPoints: [`High-yield gap filling strategies`, `Sentence transformation rules`, `Exam presentation tips`]
    }
  ] : isSocialScience ? [
    {
      title: `1. Historical/Civic Foundation & Definition of ${topic}`,
      explanation: `In ${subject}, ${topic} represents a key historical, constitutional, or socio-economic development in ${chapter}. Understanding its origins and socio-political context is central to CBSE assessment.`,
      formulaOrRule: `Constitutional / Historical Framework defining ${topic}`,
      intuition: `Social and civic structures evolve in response to public needs and institutional reforms.`,
      example: `A pivotal event or legal reform illustrating ${topic} in Class ${classLevel} syllabus.`,
      commonMistake: `Confusing historical dates, constitutional provisions, or civic jurisdictions.`,
      importantPoints: [`Core constitutional/historical premise`, `Key institutional bodies involved`, `Impact on democratic society`]
    },
    {
      title: `2. Institutional Mechanisms & Key Principles of ${topic}`,
      explanation: `Examines how governing bodies, democratic institutions, and economic policies implement ${topic} in practice.`,
      formulaOrRule: `Policy framework and statutory mechanism`,
      intuition: `Democratic systems balance public welfare, constitutional accountability, and administrative decentralization.`,
      example: `How statutory policies address disparities relating to ${topic}.`,
      commonMistake: `Overlooking the role of public participation and legal checks and balances.`,
      importantPoints: [`Division of powers`, `Socio-economic indicators`, `Public accountability`]
    },
    {
      title: `3. Socio-Economic Impact & Real-World Implications`,
      explanation: `${topic} directly shapes regional equity, citizen rights, environmental resources, and sustainable national progress.`,
      formulaOrRule: `Socio-economic impact assessment framework`,
      intuition: `Policies must balance economic growth with environmental preservation and social justice.`,
      example: `A case study highlighting regional development in relation to ${topic}.`,
      commonMistake: `Assuming economic indicators reflect equitable social distribution without analyzing disparities.`,
      importantPoints: [`Equitable resource allocation`, `Sustainable development`, `Human development index implications`]
    },
    {
      title: `4. High-Yield Board Exam Answer Writing Architecture for ${topic}`,
      explanation: `Mastering 3-mark and 5-mark answer structuring: introduction, clear headings with analytical points, and constructive conclusions.`,
      formulaOrRule: `Point-wise board answer structure for ${subject}`,
      intuition: `CBSE evaluators reward structured, point-wise explanations backed by authoritative terms.`,
      example: `A model 5-mark answer framework addressing ${topic} with subheadings.`,
      commonMistake: `Writing continuous unstructured paragraphs without subheadings or bullet points.`,
      importantPoints: [`Structured point-wise presentation`, `Inclusion of constitutional/historical terms`, `Balanced critical evaluation`]
    }
  ] : [
    {
      title: `1. Core Scientific/Mathematical Principle of ${topic}`,
      explanation: `Formalizes the theoretical definitions, boundary conditions, and fundamental laws governing ${topic} in ${chapter}.`,
      formulaOrRule: `Governing rule or equation for ${topic}`,
      intuition: `Direct and inverse relationships explain system behavior under varying constraints.`,
      example: `Standard textbook problem demonstrating ${topic}.`,
      commonMistake: `Overlooking boundary conditions or standard unit consistency.`,
      importantPoints: [`Fundamental definition`, `Governing parameters`, `Verification criteria`]
    },
    {
      title: `2. Analytical Derivations & Quantitative Applications`,
      explanation: `Step-by-step problem-solving methods and algebraic derivations for ${topic}.`,
      formulaOrRule: `Standard analytical formulation for ${topic}`,
      intuition: `Break down complex numericals into known variables, target variables, and governing formulas.`,
      example: `Step-by-step resolution of a numerical question on ${topic}.`,
      commonMistake: `Calculation slips and arithmetic errors in intermediate steps.`,
      importantPoints: [`Formula substitution`, `Dimensional consistency`, `Final answer unit check`]
    },
    {
      title: `3. Exam Pitfalls & High-Yield Concept Clarifications`,
      explanation: `Analyzing frequent student misconceptions and boundary traps identified in board evaluation audits.`,
      formulaOrRule: `Self-check verification criteria for ${topic}`,
      intuition: `Always check whether your final result is physically and mathematically reasonable.`,
      example: `A problem where ignoring constraints leads to an incorrect extraneous solution.`,
      commonMistake: `Failing to check constraints on final answers.`,
      importantPoints: [`Common board pitfalls`, `Constraint verification`, `Presentation standards`]
    }
  ];

  const subtopics: AdaptiveSubtopic[] = subtopicTemplates.map((t, idx) => ({
    id: `sub_${idx + 1}`,
    ...t
  }));

  const theory_qa: AdaptiveTheoryReviewQuestion[] = [
    {
      id: 'tqa_1',
      question: `Explain the fundamental concept of ${topic} in the context of ${chapter} (${subject}).`,
      theoreticalAnswer: `In ${board} Class ${classLevel} ${subject}, ${topic} defines the essential rules and mechanisms governing ${chapter}. Mastering this topic requires understanding its foundational premises, standard application structures, and distinguishing it from related concepts.`,
      keyPoints: [`Core curriculum definition of ${topic}`, `Key governing principles in ${chapter}`, `Practical and academic significance`],
      boardMarkingTip: `State the definition clearly and provide at least one relevant textbook illustration.`
    },
    {
      id: 'tqa_2',
      question: `What are the primary rules or governing conditions associated with ${topic}?`,
      theoreticalAnswer: `The governing conditions for ${topic} dictate when and how the principle is validly applied. In examinations, students must state the primary rule, specify relevant variables or parameters, and note any boundary conditions or exceptions.`,
      keyPoints: [`Governing structural rule`, `Valid conditions of application`, `Key exceptions`],
      boardMarkingTip: `List conditions in bullet points to earn full marking scheme allocation.`
    },
    {
      id: 'tqa_3',
      question: `What frequent misconceptions or errors do students make regarding ${topic}, and how can they be avoided?`,
      theoreticalAnswer: `Students frequently make errors by confusing ${topic} with neighboring concepts in ${chapter}, applying rules outside their valid boundary conditions, or rushing through answers without verifying consistency. Avoid these errors by checking assumptions and adhering to standard board guidelines.`,
      keyPoints: [`Specific common misconception`, `Boundary condition constraint`, `Verification strategy`],
      boardMarkingTip: `Explicitly contrast the incorrect assumption with the verified standard rule.`
    }
  ];

  const summary = [
    `${topic} is a core foundational concept in ${chapter} (${subject}).`,
    `Accurate understanding requires strict adherence to ${subject} rules and conventions.`,
    `Reviewing theoretical questions and worked examples prevents frequent exam traps.`,
    `Always verify your answers against standard curriculum criteria.`
  ];

  const diffs: ('easy' | 'moderate' | 'hard')[] = [
    'easy', 'easy', 'easy', 'easy',
    'moderate', 'moderate', 'moderate',
    'hard', 'hard', 'hard'
  ];

  const questions: AdaptiveTheoryQuestion[] = diffs.map((diff, i) => {
    const correctIdx = (i * 2 + 1) % 4;
    const opts = isLanguageSubject ? [
      `It correctly follows the standard grammatical rule of ${topic} in ${board} Class ${classLevel} English.`,
      `It violates subject-verb agreement and introduces an inappropriate tense shift.`,
      `It incorrectly uses a stative verb in a progressive continuous aspect.`,
      `It misplaces the auxiliary verb and omits required inflectional markers.`
    ] : isSocialScience ? [
      `It represents the verified constitutional and historical framework of ${topic} in CBSE syllabus.`,
      `It contradicts democratic decentralization and statutory governance principles.`,
      `It suggests that collective public participation plays no role in national development.`,
      `It ignores socio-economic indicators and equitable resource allocation standards.`
    ] : [
      `It accurately satisfies the fundamental governing principle of ${topic} as established in ${board} curriculum.`,
      `It contradicts fundamental conservation properties and boundary limits of ${topic}.`,
      `It applies exclusively to invalid assumptions and produces undefined values.`,
      `It suggests that ${topic} has no observable or theoretical relationship with ${chapter}.`
    ];

    const rotated = [...opts];
    const temp = rotated[0];
    rotated[0] = rotated[correctIdx];
    rotated[correctIdx] = temp;

    return {
      id: `q_th_${i + 1}`,
      question: `Question ${i + 1}: In the study of ${topic} (${chapter}), which statement accurately reflects curriculum principles?`,
      difficulty: diff,
      options: rotated,
      correctOptionIndex: correctIdx,
      answer: rotated[correctIdx],
      explanation: `According to ${board} Class ${classLevel} ${subject} curriculum, ${topic} is accurately formulated in Option ${String.fromCharCode(65 + correctIdx)}.`,
      conceptTested: `${topic} Principle ${i + 1}`
    };
  });

  const practice: AdaptivePracticeQuestion[] = [1, 2, 3, 4, 5].map(idx => {
    const cIdx = (idx * 3) % 4;
    const opts = [
      `It verifies the standard analytical solution for ${topic}.`,
      `It violates the basic boundary limit required for ${topic}.`,
      `It generates an inverted result unsupported by curriculum evidence.`,
      `It yields an indeterminate outcome under standard conditions.`
    ];
    const rotated = [...opts];
    const temp = rotated[0];
    rotated[0] = rotated[cIdx];
    rotated[cIdx] = temp;

    return {
      id: `q_pr_${idx}`,
      question: `Practice Exercise ${idx}: Apply the rules of ${topic} in ${chapter} to identify the correct statement:`,
      difficulty: idx <= 2 ? 'easy' : idx <= 4 ? 'moderate' : 'hard',
      options: rotated,
      correctOptionIndex: cIdx,
      answer: rotated[cIdx],
      explanation: `Applying the standard rules for ${topic} establishes Option ${String.fromCharCode(65 + cIdx)} as the correct resolution.`,
      hint: `Recall the governing formula and boundary conditions for ${topic}.`
    };
  });

  return {
    id: `lesson_${subject.toLowerCase().slice(0, 3)}_${topic.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
    subject,
    chapter,
    topic,
    studentLevel,
    difficulty_level: studentLevel === 'Weak' ? 'Beginner' : studentLevel === 'Strong' ? 'Advanced' : 'Intermediate',
    learning_objectives: [
      `Understand fundamental definitions and principles of ${topic}`,
      `Master key rules and analytical structures for ${topic}`,
      `Solve diverse difficulty-tiered questions on ${topic}`,
      `Identify and eliminate common examination misconceptions`
    ],
    subtopics,
    theory: `Welcome to today's personalized study session on **${topic}** from **${chapter}** (${subject}, Class ${classLevel} ${board}). This lesson has been calibrated to your current mastery level (${studentLevel}), breaking down the material step-by-step with practical intuition, clear rules, and rigorous practice.`,
    theory_qa,
    questions,
    summary,
    practice_questions: practice,
    allocatedMinutes,
    source: 'curriculum_fallback',
    createdAt: new Date().toISOString()
  };
}
