// Demandes commerciales — envoi des formulaires « Demander une démonstration » et
// « Contact et prise de rendez-vous » à l'API RedJam, qui les enregistre dans sa
// base de données (module CRM « Demandes commerciales »).
//
// Adresse de l'API : balise <meta name="signalo-api" content="…"> de la page, sinon
// https://api.redjam-signalo.com. Aucun secret ici : l'API publique ne fait
// qu'enregistrer une demande et lister les créneaux libres.

export function apiBase() {
    const meta = document.querySelector('meta[name="signalo-api"]');
    return (meta?.content || 'https://api.redjam-signalo.com').replace(/\/+$/, '');
}

// Clé d'une soumission : une même demande renvoyée (double clic, nouvel essai après une
// coupure) n'est enregistrée qu'une fois. Renouvelée après un envoi réussi.
export function nouvelleCle() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, '');
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export class ErreurEnvoi extends Error {
    constructor(message, { champs = null, code = null, statut = 0 } = {}) {
        super(message);
        this.champs = champs;
        this.code = code;
        this.statut = statut;
    }
}

const MSG_RESEAU = 'Impossible de joindre le serveur. Vérifiez votre connexion internet puis réessayez : vos informations sont conservées.';

async function appel(chemin, options = {}) {
    let reponse;
    try {
        reponse = await fetch(`${apiBase()}${chemin}`, {
            ...options,
            headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
        });
    } catch (e) {
        throw new ErreurEnvoi(MSG_RESEAU, { code: 'RESEAU' });
    }
    let corps = null;
    try { corps = await reponse.json(); } catch (e) { /* réponse non JSON */ }
    if (!reponse.ok || !corps || corps.success !== true) {
        const err = corps?.error;
        throw new ErreurEnvoi(err?.message || `Le serveur n'a pas pu enregistrer la demande (erreur ${reponse.status}). Merci de réessayer.`, { champs: err?.champs || null, code: err?.code || null, statut: reponse.status });
    }
    return corps.data;
}

export const envoyerDemonstration = (donnees) => appel('/demandes-commerciales/demonstration', { method: 'POST', body: JSON.stringify(donnees) });
export const envoyerContact = (donnees) => appel('/demandes-commerciales/contact', { method: 'POST', body: JSON.stringify(donnees) });
export const chargerAgenda = () => appel('/demandes-commerciales/agenda');

// Erreurs affichées près des champs concernés (attribut data-champ sur le conteneur).
export function afficherErreursChamps(form, champs) {
    effacerErreursChamps(form);
    // Erreur sur une coordonnée résumée (masquée) : tous les champs sont rouverts pour correction.
    if (Object.keys(champs || {}).some((nom) => form.querySelector(`[data-champ="${nom}"]`)?.hasAttribute('hidden'))) {
        form.querySelectorAll('[data-champ][hidden]').forEach((z) => z.removeAttribute('hidden'));
        document.getElementById('reconnu')?.setAttribute('hidden', '');
    }
    let premier = null;
    for (const [nom, message] of Object.entries(champs || {})) {
        const zone = form.querySelector(`[data-champ="${nom}"]`);
        if (!zone) continue;
        zone.classList.add('a-erreur');
        const msg = zone.querySelector('.erreur-champ');
        if (msg) msg.textContent = message;
        const saisie = zone.querySelector('input, select, textarea');
        if (saisie) {
            saisie.setAttribute('aria-invalid', 'true');
            premier ??= saisie;
        }
    }
    premier?.focus();
    return Boolean(premier);
}

export function effacerErreursChamps(form) {
    form.querySelectorAll('.a-erreur').forEach((z) => z.classList.remove('a-erreur'));
    form.querySelectorAll('.erreur-champ').forEach((m) => { m.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((s) => s.removeAttribute('aria-invalid'));
}

// Contrôle avant envoi (le serveur revérifie tout) : mêmes règles, mêmes messages.
export function controlerChamps(form, regles) {
    const champs = {};
    for (const [nom, regle] of Object.entries(regles)) {
        const el = form.elements[nom];
        const valeur = el?.type === 'checkbox' ? el.checked : String(el?.value || '').trim();
        const message = regle(valeur);
        if (message) champs[nom] = message;
    }
    return champs;
}

export const regles = {
    obligatoire: (libelle) => (v) => (v ? null : `${libelle} est obligatoire.`),
    email: (v) => (!v ? "L'adresse e-mail est obligatoire." : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'Adresse e-mail invalide.'),
    telephone: (v) => {
        if (!v) return 'Le téléphone est obligatoire.';
        const chiffres = v.replace(/\D/g, '').length;
        return /^\+?[0-9 ().-]{6,25}$/.test(v) && chiffres >= 9 && chiffres <= 15 ? null : 'Numéro de téléphone invalide.';
    },
    confidentialite: (v) => (v ? null : 'Merci de confirmer avoir lu la politique de confidentialité.'),
};

// Autocomplétion des communes françaises (API officielle geo.api.gouv.fr) : renseigne le
// code INSEE, utilisé par le CRM pour rattacher la demande à la bonne commune.
export function autocompletionCommune(input, liste, surChoix) {
    let minuterie = 0, requete = 0, elements = [], actif = -1;
    const masquer = () => {
        liste.hidden = true; liste.innerHTML = ''; elements = []; actif = -1;
        input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    };
    const choisir = (c) => { input.value = c.nom; surChoix(c); masquer(); };
    const afficher = (communes) => {
        masquer();
        // Réponse arrivée après que le visiteur a quitté le champ : rien à afficher.
        if (!communes.length || document.activeElement !== input) return;
        elements = communes;
        communes.forEach((c, i) => {
            const li = document.createElement('li');
            li.id = `${liste.id}-${i}`;
            li.setAttribute('role', 'option');
            const nom = document.createElement('strong');
            nom.textContent = c.nom;
            const meta = document.createElement('span');
            meta.textContent = [c.codesPostaux?.[0], c.departement?.nom].filter(Boolean).join(' · ');
            li.append(nom, meta);
            li.addEventListener('mousedown', (e) => { e.preventDefault(); choisir(c); });
            liste.appendChild(li);
        });
        liste.hidden = false;
        input.setAttribute('aria-expanded', 'true');
    };
    input.addEventListener('input', () => {
        surChoix(null);
        clearTimeout(minuterie);
        const texte = input.value.trim();
        if (texte.length < 2) { requete++; masquer(); return; }
        minuterie = setTimeout(() => {
            const ticket = ++requete;
            fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(texte)}&boost=population&limit=7&fields=nom,code,codesPostaux,departement`)
                .then((r) => (r.ok ? r.json() : []))
                .then((d) => { if (ticket === requete) afficher(Array.isArray(d) ? d : []); })
                .catch(() => { if (ticket === requete) masquer(); });
        }, 250);
    });
    input.addEventListener('keydown', (e) => {
        if (liste.hidden || !elements.length) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            actif = e.key === 'ArrowDown' ? Math.min(actif + 1, elements.length - 1) : Math.max(actif - 1, 0);
            [...liste.children].forEach((li, i) => li.classList.toggle('actif', i === actif));
            input.setAttribute('aria-activedescendant', `${liste.id}-${actif}`);
        } else if (e.key === 'Enter' && actif >= 0) {
            e.preventDefault();
            choisir(elements[actif]);
        } else if (e.key === 'Escape') {
            masquer();
        }
    });
    input.addEventListener('blur', () => setTimeout(masquer, 120));
}

// ---- Liens personnalisés des e-mails (?ref=…) ----------------------------------------
// Le jeton, opaque, permet seulement de récupérer les champs du formulaire du destinataire
// de l'e-mail (commune, nom, fonction, e-mail, téléphone). Absent, expiré ou invalide :
// le formulaire reste vierge. Aucune donnée personnelle dans l'adresse de la page.
export function lireRef() {
    const ref = new URLSearchParams(location.search).get('ref') || '';
    return /^[A-Za-z0-9_-]{32}$/.test(ref) ? ref : null;
}

export async function chargerPreremplissage(ref) {
    if (!ref) return { etat: 'absent', donnees: null };
    try {
        return { etat: 'ok', donnees: await appel(`/demandes-commerciales/preremplissage?ref=${encodeURIComponent(ref)}`) };
    } catch (e) {
        return { etat: e.statut === 404 ? 'invalide' : 'indisponible', donnees: null };
    }
}

// Remplit uniquement les champs encore vides ; renvoie les champs remplis (chacun reste modifiable).
export function appliquerPreremplissage(form, donnees, correspondance) {
    const remplis = [];
    for (const [champ, cle] of Object.entries(correspondance)) {
        const el = form.elements[champ];
        const valeur = donnees?.[cle];
        if (!el || !valeur || String(el.value || '').trim()) continue;
        el.value = valeur;
        remplis.push(champ);
    }
    return remplis;
}

const LIBELLES = { organisation: 'Commune', nomComplet: 'Nom et prénom', fonction: 'Fonction', email: 'E-mail', telephone: 'Téléphone' };

/**
 * Invitation reconnue (lien de l'e-mail) : la carte de gauche affiche la commune et la
 * personne invitée ; dans le formulaire, les coordonnées connues sont résumées et seuls
 * les champs manquants restent à saisir. « Modifier » rouvre tous les champs.
 */
export function montrerInvitation(form, remplis) {
    const v = (n) => String(form.elements[n]?.value || '').trim();
    const carte = document.getElementById('carteCommune');
    if (carte && v('organisation')) {
        carte.classList.remove('anonyme');
        document.getElementById('pourCommune').textContent = 'Demande préparée pour la commune de';
        document.getElementById('communeNom').textContent = v('organisation');
        const personne = document.getElementById('personneInvitee');
        if (v('nomComplet')) {
            personne.textContent = '';
            const b = document.createElement('strong');
            b.textContent = v('nomComplet');
            personne.append(b, document.createTextNode(v('fonction') ? `, ${v('fonction')}` : ''));
            personne.hidden = false;
        }
    }
    const resume = document.getElementById('reconnu');
    if (!resume || !remplis.length) return;
    const dl = document.getElementById('reconnuListe');
    dl.textContent = '';
    for (const champ of remplis) {
        const dt = document.createElement('dt'); dt.textContent = LIBELLES[champ] || champ;
        const dd = document.createElement('dd'); dd.textContent = v(champ);
        dl.append(dt, dd);
        form.querySelector(`[data-champ="${champ}"]`)?.setAttribute('hidden', '');
    }
    resume.hidden = false;
    document.getElementById('modifierReconnu').addEventListener('click', () => {
        for (const champ of remplis) form.querySelector(`[data-champ="${champ}"]`)?.removeAttribute('hidden');
        resume.hidden = true;
        form.elements[remplis[0]]?.focus();
    }, { once: true });
}
