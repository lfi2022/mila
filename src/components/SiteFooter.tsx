import { Link } from "@tanstack/react-router";

import markAsset from "@/assets/mila-mark.png.asset.json";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-cream/50">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <img
              src={markAsset.url}
              alt=""
              width={512}
              height={512}
              loading="lazy"
              className="h-10 w-10"
            />
            <p className="font-display mt-3 text-lg">Mila</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Les listes de naissance, en toute liberté. ❤️
            </p>
          </div>

          <nav aria-labelledby="footer-mila">
            <h2 id="footer-mila" className="text-sm font-semibold">
              Mila
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/a-propos" className="hover:text-foreground">
                  À propos
                </Link>
              </li>
              <li>
                <Link to="/" hash="comment-ca-marche" className="hover:text-foreground">
                  Comment ça marche
                </Link>
              </li>
              <li>
                <Link to="/recompenses" className="hover:text-foreground">
                  Récompenses Mila
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-foreground">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/guides/liste-naissance" className="hover:text-foreground">
                  Guide liste de naissance
                </Link>
              </li>
              <li>
                <Link to="/guides/budget-cadeaux" className="hover:text-foreground">
                  Guide des budgets cadeaux
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-parents">
            <h2 id="footer-parents" className="text-sm font-semibold">
              Parents
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/auth" className="hover:text-foreground">
                  Créer ma liste
                </Link>
              </li>
              <li>
                <Link to="/auth" className="hover:text-foreground">
                  Se connecter
                </Link>
              </li>
              <li>
                <Link to="/demo" className="hover:text-foreground">
                  Voir une démo
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-foreground">
                  Mon compte
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-infos">
            <h2 id="footer-infos" className="text-sm font-semibold">
              Informations
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/confidentialite" className="hover:text-foreground">
                  Confidentialité
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="hover:text-foreground">
                  Cookies
                </Link>
              </li>
              <li>
                <Link to="/conditions" className="hover:text-foreground">
                  Conditions générales
                </Link>
              </li>
              <li>
                <Link to="/mentions-legales" className="hover:text-foreground">
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          Mila est un service indépendant. Les marques citées (Amazon, IKEA, Vertbaudet…) le sont
          uniquement à titre d'exemple et ne sont pas partenaires de Mila.
        </p>
      </div>
    </footer>
  );
}
