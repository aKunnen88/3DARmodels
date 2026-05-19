# Possible Sources – BAP Paper

Relevante academische bronnen voor de paper over AR + LLM + Arduino sensor streaming.
Verifieer volledige auteursnamen en paginanummers via de opgegeven DOI's vóór gebruik.

---

## 1. Cognitive Load Theory (CLT) — Theoretische basis

De split-attention effect is de **kern** van de motivatie voor dit systeem: sensordata
overlaid in de camera-view i.p.v. op een apart scherm elimineert extraneous cognitive load.

```bibtex
@article{sweller_cognitive_1988,
  author  = {John Sweller},
  title   = {Cognitive Load During Problem Solving: Effects on Learning},
  journal = {Cognitive Science},
  volume  = {12},
  number  = {2},
  pages   = {257--285},
  year    = {1988},
  doi     = {10.1207/s15516709cog1202_4}
}
```
**Waarom:** Oorsprong van de drie cognitieve belastingstypes (intrinsic, extraneous, germane).
Theoretische backbone van de paper. DOI: 10.1207/s15516709cog1202_4

---

```bibtex
@article{sweller_cognitive_1998,
  author  = {John Sweller and Jeroen J. G. van Merri{\"e}nboer and Fred G. W. C. Paas},
  title   = {Cognitive Architecture and Instructional Design},
  journal = {Educational Psychology Review},
  volume  = {10},
  number  = {3},
  pages   = {251--296},
  year    = {1998},
  doi     = {10.1023/A:1022193728205}
}
```
**Waarom:** Verbindt CLT met instructional design — direct toepasbaar op het AR-stappenplan.
DOI: 10.1023/A:1022193728205

---

```bibtex
@article{paas_cognitive_2020,
  author  = {Fred Paas and Jeroen J. G. van Merri{\"e}nboer},
  title   = {Cognitive-Load Theory: Methods to Manage Working Memory Load in the Learning of Complex Tasks},
  journal = {Current Directions in Psychological Science},
  volume  = {29},
  number  = {4},
  pages   = {394--398},
  year    = {2020},
  doi     = {10.1177/0963721420922183}
}
```
**Waarom:** Recente consolidatie van CLT; beschrijft strategieën voor complexe taken — relevant
voor Arduino-assembly als complexe taak. DOI: 10.1177/0963721420922183

---

## 2. Split-Attention Effect — Directe motivatie voor het ontwerp

Het bekijken van sensordata op een **apart scherm** terwijl je met hardware werkt is een
klassiek split-attention scenario: de leerder moet twee fysiek gescheiden informatiebronnen
integreren. Het AR-systeem elimineert dit door alles in één visueel veld te brengen.

```bibtex
@article{chandler_split_1992,
  author  = {Paul Chandler and John Sweller},
  title   = {The Split-Attention Effect as a Factor in the Design of Instruction},
  journal = {British Journal of Educational Psychology},
  volume  = {62},
  number  = {2},
  pages   = {233--246},
  year    = {1992},
  doi     = {10.1111/j.2044-8279.1992.tb01017.x}
}
```
**Waarom:** Primaire bron voor split-attention. Legt uit waarom geïntegreerde informatie beter
werkt dan gescheiden bronnen. DOI: 10.1111/j.2044-8279.1992.tb01017.x

---

```bibtex
@incollection{ayres_split_2014,
  author    = {Paul Ayres and John Sweller},
  title     = {The Split-Attention Principle in Multimedia Learning},
  booktitle = {The Cambridge Handbook of Multimedia Learning},
  editor    = {Richard E. Mayer},
  edition   = {2},
  chapter   = {8},
  pages     = {206--226},
  publisher = {Cambridge University Press},
  address   = {Cambridge},
  year      = {2014},
  doi       = {10.1017/CBO9781139547369.012}
}
```
**Waarom:** Breidt split-attention uit naar digitale/multimedia contexten — sluit aan bij de
browser-based implementatie. DOI: 10.1017/CBO9781139547369.012

---

## 3. AR en Cognitive Load in Onderwijs

```bibtex
@article{buchner_impact_2022,
  author  = {Josef Buchner and Katharina Buntins and Michael Kerres},
  title   = {The Impact of Augmented Reality on Cognitive Load and Performance: A Systematic Review},
  journal = {Journal of Computer Assisted Learning},
  volume  = {38},
  number  = {1},
  pages   = {285--303},
  year    = {2022},
  doi     = {10.1111/jcal.12617}
}
```
**Waarom:** Systematische review van 54 studies: AR verlaagt extraneous cognitive load.
Sterkste empirische onderbouwing voor de kern-claim van de paper. DOI: 10.1111/jcal.12617

---

```bibtex
@article{thees_effects_2020,
  author  = {Michael F. Thees and Sebastian Kapp and Martin P. Strzys and Fabian Beil
             and Paul Lukowicz and Jochen Kuhn},
  title   = {Effects of Augmented Reality on Learning and Cognitive Load
             in University Physics Laboratory Courses},
  journal = {Computers in Human Behavior},
  volume  = {108},
  pages   = {106316},
  year    = {2020},
  doi     = {10.1016/j.chb.2020.106316}
}
```
**Waarom:** Smart glasses overlaid thermische cameradata **direct op een verwarmde metalen
staaf** in een fysica-lab — structureel identiek aan het Arduino HC-SR04 scenario. Studenten
rapporteerden significant lagere extraneous load vs. apart scherm. Sterkste structurele match
met dit project in de literatuur. DOI: 10.1016/j.chb.2020.106316

---

```bibtex
@article{suzuki_measuring_2024,
  author  = {Kei Suzuki and others},
  title   = {Measuring Cognitive Load in Augmented Reality with Physiological Methods:
             A Systematic Review},
  journal = {Journal of Computer Assisted Learning},
  volume  = {40},
  number  = {2},
  pages   = {492--509},
  year    = {2024},
  doi     = {10.1111/jcal.12882}
}
% TODO: verify full author list at DOI before submission
```
**Waarom:** Methodologie voor het meten van cognitive load in AR-studies — nuttig als je een
gebruikerstest uitvoert en CL wilt kwantificeren. DOI: 10.1111/jcal.12882

---

## 4. AR in Electronics / Engineering Lab Onderwijs

```bibtex
@article{singh_evaluating_2019,
  author  = {Gurjinder Singh and Anita Mantri and Omprakash Sharma
             and Ruchi Dutta and Rashim Kaur},
  title   = {Evaluating the Impact of the Augmented Reality Learning Environment
             on Electronics Laboratory Skills of Engineering Students},
  journal = {Computer Applications in Engineering Education},
  volume  = {27},
  number  = {6},
  pages   = {1361--1375},
  year    = {2019},
  doi     = {10.1002/cae.22156}
}
```
**Waarom:** AR in elektronica-lab; meet CL en vaardigheidsuitkomsten. Directe domeinmatch.
DOI: 10.1002/cae.22156

---

```bibtex
@article{tuli_augmented_2022,
  author  = {Nilufar Tuli and Gurjinder Singh and Anita Mantri and Shivani Sharma},
  title   = {Augmented Reality Learning Environment to Aid Engineering Students
             in Performing Practical Laboratory Experiments in Electronics Engineering},
  journal = {Smart Learning Environments},
  volume  = {9},
  number  = {1},
  pages   = {26},
  year    = {2022},
  doi     = {10.1186/s40561-022-00207-9}
}
```
**Waarom:** AR-lab manual voor elektronicatechnici; quasi-experimenteel design vergelijkbaar
met een mogelijke evaluatie van dit systeem. DOI: 10.1186/s40561-022-00207-9

---

```bibtex
@article{singh_interactive_2024,
  author  = {Gurjinder Singh and Fayaz Ahmad},
  title   = {An Interactive Augmented Reality Framework to Enhance the User Experience
             and Operational Skills in Electronics Laboratories},
  journal = {Smart Learning Environments},
  volume  = {11},
  number  = {1},
  pages   = {5},
  year    = {2024},
  doi     = {10.1186/s40561-023-00287-1}
}
```
**Waarom:** Gebruikt een Arduino als fysiek-AR-brug in een elektronica-lab — architectureel
de nauwste match met dit project in de gepubliceerde literatuur. DOI: 10.1186/s40561-023-00287-1

---

```bibtex
@article{iriqat_augmented_2025,
  author  = {Sanaa Iriqat and Fahri Vatansever},
  title   = {Augmented Reality in Engineering Education: An Application
             for Electronic Circuits Laboratory},
  journal = {Computer Animation and Virtual Worlds},
  volume  = {36},
  number  = {2},
  pages   = {e70018},
  year    = {2025},
  doi     = {10.1002/cav.70018}
}
```
**Waarom:** Heel recent (2025); AR voor schakelingen-lab in ingenieursopleiding.
DOI: 10.1002/cav.70018

---

```bibtex
@article{soni_transforming_2025,
  author  = {Soni and others},
  title   = {Transforming {IoT} Skill Development in Engineering Education:
             The Influence of Augmented Reality-Based Learning Environment},
  journal = {Computer Applications in Engineering Education},
  volume  = {33},
  number  = {2},
  pages   = {e70087},
  year    = {2025},
  doi     = {10.1002/cae.70087}
}
% TODO: verify full first author name at https://onlinelibrary.wiley.com/doi/10.1002/cae.70087
```
**Waarom:** AR-gebaseerde IoT-vaardighedenstudie; rapporteert 36% retentieverbetering.
Combineert IoT + AR + engineering education — alle drie kernthema's van dit project.
DOI: 10.1002/cae.70087

---

## 5. Situated Learning — Theoretische grondslag voor leren op de werkplek

```bibtex
@book{lave_situated_1991,
  author    = {Jean Lave and Etienne Wenger},
  title     = {Situated Learning: Legitimate Peripheral Participation},
  publisher = {Cambridge University Press},
  address   = {Cambridge},
  year      = {1991},
  isbn      = {978-0-521-42374-8}
}
```
**Waarom:** Situated learning = leren op het moment en de plek van handelen. De LLM-chatbot
in de AR-interface geeft feedback *terwijl* de student de sensor in handen heeft — dat is
de definitie van situated learning. ISBN: 978-0-521-42374-8

---

```bibtex
@article{brown_situated_1989,
  author  = {John Seely Brown and Allan Collins and Paul Duguid},
  title   = {Situated Cognition and the Culture of Learning},
  journal = {Educational Researcher},
  volume  = {18},
  number  = {1},
  pages   = {32--42},
  year    = {1989},
  doi     = {10.3102/0013189X018001032}
}
```
**Waarom:** Authentieke activiteit + context = beter leerrendement en transfervermogen.
Onderbouwt waarom feedback in de fysieke context (AR) effectiever is dan op een apart scherm.
DOI: 10.3102/0013189X018001032

---

## 6. AR Deployment / Toegankelijkheid (Browser vs. Native)

```bibtex
@article{lin_meta_2023,
  author  = {Chiu-Jung Lin and others},
  title   = {A Meta-Analysis of the Effects of Augmented Reality Technologies
             in Interactive Learning Environments (2012--2022)},
  journal = {Computer Applications in Engineering Education},
  volume  = {31},
  number  = {5},
  pages   = {1291--1310},
  year    = {2023},
  doi     = {10.1002/cae.22628}
}
% TODO: verify full author list at DOI
```
**Waarom:** Meta-analyse (2012–2022) over AR in interactieve leeromgevingen; behandelt
deployment-modaliteiten en toegankelijkheid — onderbouwt de keuze voor browser-based AR.
DOI: 10.1002/cae.22628

---

## 7. Real-Time IoT Data Visualisatie in AR (Industrieel / Educatief)

```bibtex
@article{maio_pervasive_2023,
  author  = {Rafael Maio and Tiago Ara{\'u}jo and Bernardo Marques and Andr{\'e} Santos
             and Pedro Ramalho and Duarte Almeida and Paulo Dias and Beatriz Sousa Santos},
  title   = {Pervasive Augmented Reality to Support Real-Time Data Monitoring
             in Industrial Scenarios: Shop Floor Visualization Evaluation and User Study},
  journal = {Computers \& Graphics},
  volume  = {118},
  pages   = {11--22},
  year    = {2023},
  doi     = {10.1016/j.cag.2023.10.025}
}
```
**Waarom:** Pervasive AR voor real-time sensormonitoring op een werkvloer — het industriële
equivalent van dit systeem. Toont dat in-situ datavisualisatie taakprestaties verbetert en
visuele aandachtsomleiding vermindert. DOI: 10.1016/j.cag.2023.10.025

---

## 8. LLM / AI Chatbot in Hogere Onderwijs en Immersieve Omgevingen

```bibtex
@article{yigci_large_2025,
  author  = {Defne Yigci and Muhammet Eryilmaz and Ali K. Yetisen
             and Savas Tasoglu and Aydogan Ozcan},
  title   = {Large Language Model-Based Chatbots in Higher Education},
  journal = {Advanced Intelligent Systems},
  volume  = {7},
  number  = {3},
  pages   = {2400429},
  year    = {2025},
  doi     = {10.1002/aisy.202400429}
}
```
**Waarom:** LLM-chatbots verbeteren leerresultaten in hoger onderwijs; contextualiseert de
geïntegreerde chatbot in dit systeem. DOI: 10.1002/aisy.202400429

---

```bibtex
@article{amirkhani_architecture_2025,
  author  = {others},
  title   = {An Architecture for Intelligent Tutoring in Virtual Reality:
             Integrating {LLMs} and Multimodal Interaction for Immersive Learning},
  journal = {Information},
  volume  = {16},
  number  = {7},
  pages   = {556},
  year    = {2025},
  doi     = {10.3390/info16070556}
}
% TODO: verify full author list at https://www.mdpi.com/2078-2489/16/7/556
```
**Waarom:** LLM geïntegreerd in een immersieve omgeving voor in-context Q&A — nauwste
architecturele match met de LLM-in-AR-interface van dit project. DOI: 10.3390/info16070556

---

## Overzichtstabel

| Bron | Onderwerp | Jaar | Relevantie |
|---|---|---|---|
| Sweller 1988 | CLT origin | 1988 | Theoretische backbone |
| Sweller et al. 1998 | CLT + instructional design | 1998 | Koppelt CLT aan ontwerpkeuzes |
| Paas & van Merriënboer 2020 | CLT modern | 2020 | Werkgeheugenbelasting bij complexe taken |
| Chandler & Sweller 1992 | Split-attention | 1992 | **Kern-motivatie ontwerp** |
| Ayres & Sweller 2014 | Split-attention multimedia | 2014 | Breidt uit naar digitale contexten |
| Buchner et al. 2022 | AR + CL review | 2022 | 54 studies: AR verlaagt extraneous load |
| Thees et al. 2020 | AR + physics lab | 2020 | **Structurele match**: sensor overlay in lab |
| Suzuki et al. 2024 | CL meten in AR | 2024 | Methodologie gebruikerstest |
| Singh et al. 2019 | AR elektronica-lab | 2019 | Domeinmatch: elektronica + CL meting |
| Tuli et al. 2022 | AR elektronica-lab | 2022 | Quasi-experimenteel design |
| Singh & Ahmad 2024 | AR + Arduino lab | 2024 | **Architecturele match**: Arduino als AR-brug |
| Iriqat & Vatansever 2025 | AR schakelingen-lab | 2025 | Heel recent, zelfde domein |
| Soni et al. 2025 | AR + IoT engineering | 2025 | IoT + AR + engineering, 36% retentie |
| Lave & Wenger 1991 | Situated learning | 1991 | Leren op plek van handelen |
| Brown et al. 1989 | Situated cognition | 1989 | Authentieke context = beter transfer |
| Maio et al. 2023 | AR + real-time IoT data | 2023 | Industriële sensor-overlay in AR |
| Lin et al. 2023 | AR meta-analyse | 2023 | Deployment-modaliteiten, toegankelijkheid |
| Yigci et al. 2025 | LLM chatbot in HO | 2025 | LLM-chatbot verbetert leerresultaten |
| Amirkhani et al. 2025 | LLM + immersive tutoring | 2025 | LLM in immersieve omgeving voor Q&A |

---

## Aandachtspunten voor gebruik

- Bronnen van vóór 2015 (Sweller, Chandler, Lave, Brown) zijn **foundational works** —
  het is academisch gebruikelijk en noodzakelijk om ze te citeren voor theoretische legitimiteit.
- Verifieer **volledige auteursnamen** voor entries met `others` via de opgegeven DOI's
  vóór opname in `references.bib`.
- Controleer paginanummers via Limo (limo.libis.be) of de UHasselt bibliotheek voor
  bronnen waarbij je twijfelt.
- Voor browser-based AR vs. native AR bestaat nog geen dedicated peer-reviewed vergelijking;
  gebruik Lin et al. 2023 als beste beschikbare proxy.
