/**
 * Page text in Swahili and French: the buttons, headings, column titles,
 * statuses and field labels that appear across the app.
 *
 * One line per phrase: English | Kiswahili | Français. Looked up by the exact
 * English wording, so a phrase without a line stays in English rather than
 * showing a key. Loaded only for a business that has chosen another language.
 *
 * Written without a native reviewer. Longer sentences, documents and messages
 * sent to customers are not covered and remain in English.
 */
const LINES = `
Cancel | Ghairi | Annuler
Total | Jumla | Total
Totals | Jumla | Totaux
Status | Hali | Statut
Email | Barua pepe | E-mail
Description | Maelezo | Description
All | Zote | Tout
Notes | Maelezo | Notes
Note | Maelezo | Note
Reset | Weka upya | Réinitialiser
Amount | Kiasi | Montant
Client | Mteja | Client
Clients | Wateja | Clients
Customer | Mteja | Client
Qty | Idadi | Qté
Quantity | Idadi | Quantité
Method | Njia | Mode
Search | Tafuta | Rechercher
Search… | Tafuta… | Rechercher…
Active | Hai | Actif
Inactive | Si hai | Inactif
Archived | Imehifadhiwa | Archivé
Delete | Futa | Supprimer
Supplier | Msambazaji | Fournisseur
Suppliers | Wasambazaji | Fournisseurs
Balance | Salio | Solde
Date | Tarehe | Date
Optional | Si lazima | Facultatif
Clear filters | Ondoa vichujio | Effacer les filtres
Clear | Futa | Effacer
Clear search | Futa utafutaji | Effacer la recherche
Phone | Simu | Téléphone
Reference | Kumbukumbu | Référence
Ref | Kumb. | Réf.
View | Tazama | Voir
Item | Bidhaa | Article
Items | Bidhaa | Articles
Type | Aina | Type
Received | Imepokelewa | Reçu
Newest | Mpya zaidi | Plus récent
Oldest | Za zamani | Plus ancien
Filter | Chuja | Filtrer
Paid | Imelipwa | Payé
Unpaid | Haijalipwa | Impayé
Open | Wazi | Ouvert
Closed | Imefungwa | Fermé
Add | Ongeza | Ajouter
Sales | Mauzo | Ventes
Edit | Hariri | Modifier
Other | Nyingine | Autre
Save | Hifadhi | Enregistrer
Save changes | Hifadhi mabadiliko | Enregistrer les modifications
Save details | Hifadhi maelezo | Enregistrer les détails
Save line | Hifadhi mstari | Enregistrer la ligne
Name | Jina | Nom
Full name | Jina kamili | Nom complet
Full name * | Jina kamili * | Nom complet *
Address | Anwani | Adresse
Address / location | Anwani / mahali | Adresse / lieu
Pending | Inasubiri | En attente
Due | Inadaiwa | Dû
Due date | Tarehe ya kulipa | Échéance
Due first | Zinazodaiwa kwanza | Échéances d'abord
Overdue | Imepitiliza | En retard
Late | Imechelewa | En retard
On time | Kwa wakati | À temps
Actions | Vitendo | Actions
Action | Kitendo | Action
More actions | Vitendo zaidi | Plus d'actions
Preview | Hakiki | Aperçu
Close preview | Funga hakiki | Fermer l'aperçu
Print / PDF | Chapisha / PDF | Imprimer / PDF
Download PDF | Pakua PDF | Télécharger le PDF
Download | Pakua | Télécharger
Download Invoice | Pakua ankara | Télécharger la facture
Receipt PDF | PDF ya risiti | PDF du reçu
Export CSV | Hamisha CSV | Exporter en CSV
Create | Unda | Créer
Completed | Imekamilika | Terminé
Done | Imekamilika | Terminé
Device | Kifaa | Appareil
Invoices | Ankara | Factures
Invoice | Ankara | Facture
Invoice # | Ankara # | Facture n°
Create Invoice | Unda ankara | Créer une facture
Convert to Invoice | Badilisha kuwa ankara | Convertir en facture
Outstanding | Inayodaiwa | Impayé
Job | Kazi | Réparation
Jobs | Kazi | Réparations
Job # | Kazi # | Réparation n°
Open Job | Fungua kazi | Ouvrir la réparation
Open Jobs | Kazi zilizo wazi | Réparations en cours
Edit Job | Hariri kazi | Modifier la réparation
Go to jobs | Nenda kwenye kazi | Aller aux réparations
Balance Sheet | Mizania | Bilan
Finance | Fedha | Finances
Category | Kundi | Catégorie
Expenses | Matumizi | Dépenses
Created | Imeundwa | Créé
Change | Badilisha | Modifier
Share | Shiriki | Partager
Send | Tuma | Envoyer
Send via WhatsApp | Tuma kwa WhatsApp | Envoyer par WhatsApp
Send by WhatsApp | Tuma kwa WhatsApp | Envoyer par WhatsApp
Send by Email | Tuma kwa barua pepe | Envoyer par e-mail
Open WhatsApp Link | Fungua kiungo cha WhatsApp | Ouvrir le lien WhatsApp
Set up WhatsApp | Sanidi WhatsApp | Configurer WhatsApp
WhatsApp unavailable | WhatsApp haipatikani | WhatsApp indisponible
Email unavailable | Barua pepe haipatikani | E-mail indisponible
Contact | Mawasiliano | Contact
Contact Name | Jina la mhusika | Nom du contact
Contact Phone | Simu ya mhusika | Téléphone du contact
Contact Person | Mhusika | Personne à contacter
Monthly | Kila mwezi | Mensuel
Annual | Kila mwaka | Annuel
Apply | Tumia | Appliquer
Subtotal | Jumla ndogo | Sous-total
Danger zone | Eneo la hatari | Zone de danger
Unit cost | Gharama ya kimoja | Coût unitaire
Unit Cost | Gharama ya kimoja | Coût unitaire
Unit price | Bei ya kimoja | Prix unitaire
Unit Price | Bei ya kimoja | Prix unitaire
Price | Bei | Prix
Approved | Imeidhinishwa | Approuvé
Approve | Idhinisha | Approuver
Approval | Idhini | Approbation
Awaiting approval | Inasubiri idhini | En attente d'approbation
Awaiting Approval | Inasubiri idhini | En attente d'approbation
Awaiting | Inasubiri | En attente
Location | Mahali | Emplacement
Locations | Maeneo | Emplacements
Organization | Shirika | Organisation
System | Mfumo | Système
Profile | Wasifu | Profil
My Profile | Wasifu wangu | Mon profil
Repairs | Matengenezo | Réparations
Assigned | Imepangiwa | Attribué
Assigned To | Amepangiwa | Attribué à
Unassigned | Haijapangiwa | Non attribué
Valid Until | Halali hadi | Valable jusqu'au
Valid until | Halali hadi | Valable jusqu'au
Source | Chanzo | Source
View source | Tazama chanzo | Voir la source
Currency | Sarafu | Devise
Issue date | Tarehe ya kutolewa | Date d'émission
Issue Date | Tarehe ya kutolewa | Date d'émission
Issue | Toa | Émettre
Issued | Imetolewa | Émis
Issued by | Imetolewa na | Émis par
Reject | Kataa | Rejeter
Rejected | Imekataliwa | Rejeté
Declined | Imekataliwa | Refusé
Accepted | Imekubaliwa | Accepté
Line Items | Mistari ya bidhaa | Lignes
Add line | Ongeza mstari | Ajouter une ligne
Remove line | Ondoa mstari | Supprimer la ligne
Remove | Ondoa | Retirer
Subject | Kichwa | Objet
Message | Ujumbe | Message
Recipient | Mpokeaji | Destinataire
Ready | Tayari | Prêt
Ready for pickup | Tayari kuchukuliwa | Prêt à retirer
In Repair | Inatengenezwa | En réparation
Diagnosing | Inachunguzwa | Diagnostic
Unrepairable | Haitengenezeki | Irréparable
Parts pending | Vipuri vinasubiriwa | Pièces en attente
Cancelled | Imeghairiwa | Annulé
Refund | Rejesho | Remboursement
Refunds | Marejesho | Remboursements
Refunded | Imerejeshwa | Remboursé
Refund amount | Kiasi cha rejesho | Montant du remboursement
Issue Refund | Toa rejesho | Émettre un remboursement
On Hand | Zilizopo | En stock
Available | Zinapatikana | Disponible
Reserved | Zimehifadhiwa | Réservé
Low stock | Bidhaa chache | Stock faible
Out of stock | Zimeisha | Rupture de stock
Stock value | Thamani ya bidhaa | Valeur du stock
Receive stock | Pokea bidhaa | Réceptionner le stock
Receive | Pokea | Réceptionner
Goods received | Bidhaa zilizopokelewa | Marchandises reçues
Goods Received | Bidhaa zilizopokelewa | Marchandises reçues
Counted | Zimehesabiwa | Compté
Variance | Tofauti | Écart
Record payment | Rekodi malipo | Enregistrer un paiement
Payment | Malipo | Paiement
Payments | Malipo | Paiements
Payment method | Njia ya malipo | Mode de paiement
Payment received | Malipo yamepokelewa | Paiement reçu
Date paid | Tarehe ya malipo | Date de paiement
Invoice payments | Malipo ya ankara | Paiements de factures
Reason | Sababu | Motif
Code | Msimbo | Code
This Month | Mwezi huu | Ce mois-ci
This month | Mwezi huu | Ce mois-ci
Last month | Mwezi uliopita | Le mois dernier
All months | Miezi yote | Tous les mois
All time | Muda wote | Depuis toujours
Month | Mwezi | Mois
Today | Leo | Aujourd'hui
Received by | Imepokelewa na | Reçu par
Recorded by | Imerekodiwa na | Enregistré par
Delivered | Imewasilishwa | Livré
Delivered by | Imewasilishwa na | Livré par
Notifications | Arifa | Notifications
Templates | Violezo | Modèles
Account | Akaunti | Compte
Accounts | Akaunti | Comptes
Account number | Namba ya akaunti | Numéro de compte
Account actions | Vitendo vya akaunti | Actions du compte
Billing | Malipo ya huduma | Facturation
Sent | Imetumwa | Envoyé
Failed | Imeshindwa | Échec
Dead | Imekufa | Abandonné
Retry | Jaribu tena | Réessayer
Current | Ya sasa | Actuel
Inventory | Bidhaa | Stock
Collected | Imekusanywa | Encaissé
Collections | Makusanyo | Encaissements
Payables | Madeni | Dettes fournisseurs
Receivables | Madai | Créances
Accounts Payable | Madeni ya wasambazaji | Comptes fournisseurs
Accounts Receivable | Madai ya wateja | Comptes clients
Net | Halisi | Net
Quotations | Nukuu za bei | Devis
New Quotation | Nukuu mpya | Nouveau devis
Margin | Faida | Marge
Referred | Imeelekezwa | Recommandé
Referral | Rufaa | Recommandation
Revenue | Mapato | Chiffre d'affaires
Total Revenue | Jumla ya mapato | Chiffre d'affaires total
Total Expenses | Jumla ya matumizi | Dépenses totales
Total Equity | Jumla ya mtaji | Capitaux propres
Repair Revenue | Mapato ya matengenezo | Revenus des réparations
Value | Thamani | Valeur
Cash | Taslimu | Espèces
Card | Kadi | Carte
Bank transfer | Uhamisho wa benki | Virement bancaire
Mobile money | Pesa za simu | Mobile money
Tax | Kodi | Taxe
Tax applicable | Kodi inatumika | Taxe applicable
Tax Rates | Viwango vya kodi | Taux de taxe
Rate | Kiwango | Taux
Discount | Punguzo | Remise
Disc % | Punguzo % | Remise %
Related | Zinazohusiana | Associé
Bank Accounts | Akaunti za benki | Comptes bancaires
Bank | Benki | Banque
Chart of Accounts | Orodha ya akaunti | Plan comptable
Trial Balance | Urari | Balance
Profit & Loss | Faida na hasara | Compte de résultat
P&L | Faida na hasara | Résultat
VAT Summary | Muhtasari wa VAT | Récapitulatif TVA
Cash Flow | Mtiririko wa fedha | Trésorerie
Journal Entries | Maingizo ya jarida | Écritures comptables
Financial Reports | Ripoti za fedha | Rapports financiers
Debit | Debiti | Débit
Credit | Krediti | Crédit
Memo | Kumbukumbu | Mémo
Parent | Mzazi | Parent
Posted | Imeingizwa | Comptabilisé
Cleared | Imethibitishwa | Rapproché
Void | Batilisha | Annuler
Voided | Imebatilishwa | Annulé
New | Mpya | Nouveau
Users | Watumiaji | Utilisateurs
User | Mtumiaji | Utilisateur
Users & Roles | Watumiaji na majukumu | Utilisateurs et rôles
User Management | Usimamizi wa watumiaji | Gestion des utilisateurs
Manage users | Simamia watumiaji | Gérer les utilisateurs
Role | Jukumu | Rôle
Groups | Vikundi | Groupes
Outbox | Kikasha toezi | Boîte d'envoi
Receipt | Risiti | Reçu
Receipts | Risiti | Reçus
Dashboard | Dashibodi | Tableau de bord
Back to dashboard | Rudi kwenye dashibodi | Retour au tableau de bord
Back | Rudi | Retour
Won | Imeshinda | Gagné
Lead | Mteja mtarajiwa | Prospect
Leads | Wateja watarajiwa | Prospects
Stage | Hatua | Étape
Open Pipeline | Fursa zilizo wazi | Opportunités en cours
Follow-up | Ufuatiliaji | Relance
Follow-up date | Tarehe ya ufuatiliaji | Date de relance
Interest / product | Anachohitaji / bidhaa | Intérêt / produit
Lost reason | Sababu ya kupoteza | Motif de perte
Walk-in | Aliyefika mwenyewe | Sans rendez-vous
Call | Simu | Appel
Website | Tovuti | Site web
Activity | Shughuli | Activité
Branch | Tawi | Agence
Branches | Matawi | Agences
No branch | Hakuna tawi | Aucune agence
Platform Admin | Msimamizi wa jukwaa | Administrateur plateforme
Documents | Nyaraka | Documents
Document | Hati | Document
Needs action | Inahitaji hatua | À traiter
Attention Required | Inahitaji uangalizi | Attention requise
Highest first | Kubwa kwanza | Du plus élevé
Balance due | Salio linalodaiwa | Solde dû
New Bill | Bili mpya | Nouvelle facture fournisseur
Client Bill | Bili ya mteja | Facture client
Supplier Bills | Bili za wasambazaji | Factures fournisseurs
Purchase order | Oda ya ununuzi | Bon de commande
Purchase Orders | Oda za ununuzi | Bons de commande
Purchase Requests | Maombi ya ununuzi | Demandes d'achat
New PO | Oda mpya | Nouvelle commande
Create PO | Unda oda | Créer la commande
Open POs | Oda zilizo wazi | Commandes en cours
POs | Oda | Commandes
Ordered | Imeagizwa | Commandé
Draft | Rasimu | Brouillon
Delete Draft | Futa rasimu | Supprimer le brouillon
Request | Ombi | Demande
Submitted | Imewasilishwa | Soumis
Converted | Imebadilishwa | Converti
Buy & Receive | Nunua na pokea | Acheter et réceptionner
New supplier name | Jina la msambazaji mpya | Nom du nouveau fournisseur
Supplier Name | Jina la msambazaji | Nom du fournisseur
Prev | Iliyotangulia | Préc.
Next | Inayofuata | Suiv.
Out | Nje | Sortie
In | Ndani | Entrée
Frequency | Marudio | Fréquence
Close | Funga | Fermer
Delivery Notes | Hati za uwasilishaji | Bons de livraison
Credit Notes | Hati za mkopo | Avoirs
Job Cards | Kadi za kazi | Fiches de travail
Generate Job Card | Tengeneza kadi ya kazi | Générer la fiche de travail
Handover | Makabidhiano | Remise
Tablet | Tableti | Tablette
Model | Modeli | Modèle
Brand | Chapa | Marque
Serial / IMEI | Namba / IMEI | N° de série / IMEI
Change password | Badilisha nenosiri | Changer le mot de passe
Reset password | Weka upya nenosiri | Réinitialiser le mot de passe
New password | Nenosiri jipya | Nouveau mot de passe
Current password | Nenosiri la sasa | Mot de passe actuel
Password | Nenosiri | Mot de passe
Confirm new password | Thibitisha nenosiri jipya | Confirmer le nouveau mot de passe
Confirm password | Thibitisha nenosiri | Confirmer le mot de passe
Two-step sign-in | Uthibitisho wa hatua mbili | Connexion en deux étapes
Sign out | Ondoka | Se déconnecter
Settings | Mipangilio | Paramètres
Settings saved successfully. | Mipangilio imehifadhiwa. | Paramètres enregistrés.
Saved successfully. | Imehifadhiwa. | Enregistré.
Joined | Alijiunga | Inscrit
Communications | Mawasiliano | Communications
Branding | Chapa | Image de marque
Data Heal | Rekebisha data | Réparation des données
Business | Biashara | Entreprise
Backups | Nakala rudufu | Sauvegardes
Backup & Restore | Nakala na urejeshaji | Sauvegarde et restauration
Your data | Data yako | Vos données
Audit Log | Kumbukumbu za ukaguzi | Journal d'audit
AI Knowledge | Maarifa ya AI | Connaissances IA
From | Kutoka | De
After | Baada | Après
For | Kwa | Pour
Against | Dhidi ya | Sur
When | Lini | Quand
Helpful | Imesaidia | Utile
Not helpful | Haijasaidia | Pas utile
Field Technician | Fundi wa nje | Technicien de terrain
Technician | Fundi | Technicien
Technicians | Mafundi | Techniciens
All technicians | Mafundi wote | Tous les techniciens
Corporate Sales | Mauzo ya makampuni | Ventes entreprises
Corporate | Makampuni | Entreprises
Products | Bidhaa | Produits
POS Sales | Mauzo ya kaunta | Ventes en caisse
Point of Sale | Kituo cha mauzo | Point de vente
Internal notes | Maelezo ya ndani | Notes internes
Optional note | Maelezo (si lazima) | Note facultative
Outcome Notes | Maelezo ya matokeo | Notes de résultat
Resolved | Imetatuliwa | Résolu
Add new customer | Ongeza mteja mpya | Ajouter un client
Edit details | Hariri maelezo | Modifier les détails
High | Juu | Élevée
Normal | Kawaida | Normale
Priority | Kipaumbele | Priorité
Completed This Month | Zilizokamilika mwezi huu | Terminées ce mois-ci
Completed MTD | Zilizokamilika mwezi huu | Terminées ce mois
Field Visits | Ziara za nje | Visites sur site
New Field Visit | Ziara mpya | Nouvelle visite
Linked Job | Kazi inayohusiana | Réparation liée
Recent Assigned Jobs | Kazi za karibuni ulizopangiwa | Réparations attribuées récentes
No assigned jobs yet. | Bado hujapangiwa kazi. | Aucune réparation attribuée.
No active assignments. | Hakuna kazi zinazoendelea. | Aucune attribution en cours.
No completed jobs this month. | Hakuna kazi zilizokamilika mwezi huu. | Aucune réparation terminée ce mois-ci.
No items. | Hakuna bidhaa. | Aucun article.
No itemised lines. | Hakuna mistari. | Aucune ligne détaillée.
No preference | Hakuna chaguo | Sans préférence
Overdue Jobs | Kazi zilizopitiliza | Réparations en retard
Reports | Ripoti | Rapports
Operations | Uendeshaji | Opérations
In-house | Ndani | En interne
External | Nje | Externe
Search description, reference… | Tafuta maelezo, kumbukumbu… | Rechercher description, référence…
All statuses | Hali zote | Tous les statuts
Reference (optional) | Kumbukumbu (si lazima) | Référence (facultatif)
Showing | Inaonyesha | Affichage
Needs pricing | Inahitaji bei | Prix à définir
Priced | Imewekwa bei | Chiffré
Age | Umri | Ancienneté
Expired | Imeisha muda | Expiré
Warranty | Dhamana | Garantie
Warranty claims | Madai ya dhamana | Demandes de garantie
Copy | Nakili | Copier
Repair Requests | Maombi ya matengenezo | Demandes de réparation
Done At | Imekamilika | Terminé le
Amt | Kiasi | Mt
Short line (table view) | Mstari mfupi (jedwali) | Ligne courte (tableau)
Campaigns | Kampeni | Campagnes
Complaints | Malalamiko | Réclamations
Expense Schedules | Ratiba za matumizi | Échéanciers de dépenses
Recurring | Zinazojirudia | Récurrent
Finance Hub | Fedha | Finances
Intake | Mapokezi | Réception
New Job | Kazi mpya | Nouvelle réparation
New Purchase Order | Oda mpya ya ununuzi | Nouveau bon de commande
New Purchase Request | Ombi jipya la ununuzi | Nouvelle demande d'achat
New Stock Count | Hesabu mpya ya bidhaa | Nouvel inventaire
New Supplier | Msambazaji mpya | Nouveau fournisseur
New Supplier Bill | Bili mpya ya msambazaji | Nouvelle facture fournisseur
Stock Counts | Hesabu za bidhaa | Inventaires
Transfers | Uhamisho | Transferts
Targets | Malengo | Objectifs
Service Hub | Kituo cha huduma | Service
Sales CRM | Mauzo | Ventes
My Payouts | Malipo yangu | Mes paiements
AI Insights | Maarifa ya AI | Analyses IA
Home | Nyumbani | Accueil
More | Zaidi | Plus
Quotes | Nukuu | Devis
Delivery | Uwasilishaji | Livraison
Collect | Kusanya | Encaisser
Field | Kazi za nje | Terrain
Techs | Mafundi | Techs
Stock | Bidhaa | Stock
Language | Lugha | Langue
Good morning | Habari za asubuhi | Bonjour
Good afternoon | Habari za mchana | Bon après-midi
Good evening | Habari za jioni | Bonsoir
Revenue today | Mapato ya leo | Recettes du jour
Cash this month | Fedha mwezi huu | Encaissements du mois
Position | Hali ya fedha | Situation
Revenue trend | Mwenendo wa mapato | Évolution des recettes
year to date | tangu mwanzo wa mwaka | depuis le début de l'année
Expenses this month | Matumizi ya mwezi huu | Dépenses du mois
Bank + cash balance | Salio la benki na taslimu | Solde banque et caisse
across accounts | katika akaunti zote | tous comptes
to suppliers | kwa wasambazaji | aux fournisseurs
unpaid invoices | ankara zisizolipwa | factures impayées
Low on stock | Bidhaa chache | Stock faible
Invoices unpaid | Ankara zisizolipwa | Factures impayées
New clients this week | Wateja wapya wiki hii | Nouveaux clients cette semaine
Turn on | Washa | Activer
Turn off | Zima | Désactiver
Show | Onyesha | Afficher
Hide | Ficha | Masquer
Page | Ukurasa | Page
Reorder | Agiza tena | Réapprovisionner
No supplier | Hakuna msambazaji | Aucun fournisseur
No reference | Hakuna kumbukumbu | Aucune référence
Needs attention | Inahitaji uangalizi | À surveiller
All clear | Kila kitu sawa | Tout est en ordre
Internal Tech | Fundi wa ndani | Technicien interne
External Technician | Fundi wa nje | Technicien externe
Start diagnosis | Anza uchunguzi | Commencer le diagnostic
Admin | Msimamizi | Administrateur
Journal | Jarida | Journal
Requests | Maombi | Demandes
Qualified | Amehakikiwa | Qualifié
Proposal | Pendekezo | Proposition
Contacted | Amewasiliana | Contacté
Lost | Imepotea | Perdu
Stale | Imekaa muda | Inactif
Net Profit | Faida halisi | Bénéfice net
Gross Profit | Faida ghafi | Marge brute
Operating Expenses | Gharama za uendeshaji | Charges d'exploitation
Cost of Goods Sold | Gharama ya bidhaa zilizouzwa | Coût des marchandises vendues
Refunds Issued | Marejesho yaliyotolewa | Remboursements émis
Ready for Pickup | Tayari kuchukuliwa | Prêt à retirer
Overview | Muhtasari | Vue d'ensemble
Add Supplier | Ongeza msambazaji | Ajouter un fournisseur
New Job Intake | Mapokezi ya kazi mpya | Nouvelle réception
Client Info | Taarifa za mteja | Infos client
Device Info | Taarifa za kifaa | Infos appareil
Review | Hakiki | Vérifier
Nothing pending | Hakuna kinachosubiri | Rien en attente
Download a template | Pakua kiolezo | Télécharger un modèle
Import | Ingiza | Importer
Export | Hamisha | Exporter
Cash received | Fedha zilizopokelewa | Espèces reçues
Avg Job Value | Wastani wa thamani ya kazi | Valeur moyenne
Repeat Clients | Wateja wanaorudi | Clients fidèles
Search invoices | Tafuta ankara | Rechercher des factures
Search quotations | Tafuta nukuu | Rechercher des devis
Search suppliers | Tafuta wasambazaji | Rechercher des fournisseurs
Mine | Zangu | Les miens
Table | Jedwali | Tableau
Board | Ubao | Tableau kanban
Flag | Weka alama | Signaler
Unknown | Haijulikani | Inconnu
Money in this month | Fedha zilizoingia mwezi huu | Entrées du mois
Money out this month | Fedha zilizotoka mwezi huu | Sorties du mois
Net this month | Halisi mwezi huu | Net du mois
Collection mix | Mgawanyo wa makusanyo | Répartition des encaissements
Services | Huduma | Services
Total Suppliers | Jumla ya wasambazaji | Total fournisseurs
Outstanding Bills | Bili zinazodaiwa | Factures à payer
Overdue Bills | Bili zilizopitiliza | Factures en retard
Supplier name * | Jina la msambazaji * | Nom du fournisseur *
Top Category | Kundi kuu | Catégorie principale
Utilities | Huduma za msingi | Charges
Travel | Usafiri | Déplacements
Equipment | Vifaa | Matériel
Taxes | Kodi | Taxes
Active items | Bidhaa hai | Articles actifs
Inventory Items | Bidhaa | Articles en stock
Total Amount | Jumla ya kiasi | Montant total
All Time | Muda wote | Depuis toujours
Last Month | Mwezi uliopita | Le mois dernier
Open Value | Thamani iliyo wazi | Valeur en cours
Your account details | Maelezo ya akaunti yako | Les détails de votre compte
Your Details | Maelezo yako | Vos informations
Share of revenue | Sehemu ya mapato | Part des recettes
Act today | Shughulikia leo | À traiter aujourd'hui
Download my data | Pakua data yangu | Télécharger mes données
Import clients | Ingiza wateja | Importer des clients
Import products | Ingiza bidhaa | Importer des produits
Download everything | Pakua kila kitu | Tout télécharger
Close this workspace | Funga eneo hili la kazi | Fermer cet espace
PAID | IMELIPWA | PAYÉ
OPEN | WAZI | OUVERT
RECEIVED | IMEPOKELEWA | REÇU
EXPIRED | IMEISHA MUDA | EXPIRÉ
COMPLETED | IMEKAMILIKA | TERMINÉ
CANCELLED | IMEGHAIRIWA | ANNULÉ
ISSUED | IMETOLEWA | ÉMIS
DRAFT | RASIMU | BROUILLON
VOID | IMEBATILISHWA | ANNULÉ
CASH | TASLIMU | ESPÈCES
MOBILE MONEY | PESA ZA SIMU | MOBILE MONEY
BANK TRANSFER | UHAMISHO WA BENKI | VIREMENT
`;

type Table = Record<string, string>;
let cache: { sw: Table; fr: Table } | null = null;

function build() {
  const sw: Table = {};
  const fr: Table = {};
  for (const line of LINES.split("\n")) {
    const parts = line.split(" | ");
    if (parts.length !== 3) continue;
    const [en, swText, frText] = parts.map((part) => part.trim());
    if (!en) continue;
    sw[en] = swText;
    fr[en] = frText;
  }
  return { sw, fr };
}

/** The page-text table for a language, or null for English and unknown languages. */
export function pageTextTable(locale: string | null | undefined): Table | null {
  if (locale !== "sw" && locale !== "fr") return null;
  cache ??= build();
  return cache[locale];
}
