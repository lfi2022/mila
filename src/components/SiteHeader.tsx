import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";

import logoAsset from "@/assets/mila-logo.png.asset.json";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const navLinks = (
    <>
      <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
        <Link to="/" hash="comment-ca-marche">
          Comment ça marche
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
        <Link to="/recompenses">Récompenses</Link>
      </Button>
      <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
        <Link to="/faq">FAQ</Link>
      </Button>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center" aria-label="Mila — listes de naissance">
          <img
            src={logoAsset.url}
            alt="Mila — listes de naissance"
            width={1365}
            height={512}
            className="h-11 w-auto sm:h-12"
          />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks}
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/profil">Profil</Link>
              </Button>
              <NotificationsBell />
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/orders">À commander</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/memories">Souvenirs</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/dashboard">Mon espace</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Déconnexion
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Se connecter</Link>
              </Button>
              <Button
                asChild
                size="sm"
                onClick={() => track("signup_cta_clicked", { location: "header" })}
              >
                <Link to="/auth">Créer ma liste</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {user ? <NotificationsBell /> : null}
          <Button
            asChild
            size="sm"
            onClick={() => track("signup_cta_clicked", { location: "header_mobile" })}
          >
            <Link to={user ? "/dashboard" : "/auth"}>{user ? "Mon espace" : "Créer ma liste"}</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Ouvrir le menu">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="text-left text-lg">Menu</SheetTitle>
              <nav className="mt-6 flex flex-col items-stretch gap-1 [&_a]:justify-start">
                {navLinks}
                <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  <Link to="/demo">Voir une démo</Link>
                </Button>
                {user ? (
                  <>
                    <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
                      <Link to="/dashboard">Mes listes</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
                      <Link to="/dashboard/orders">À commander</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
                      <Link to="/dashboard/memories">Souvenirs</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
                      <Link to="/profil">Profil</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setOpen(false);
                        void signOut();
                      }}
                    >
                      Déconnexion
                    </Button>
                  </>
                ) : (
                  <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
                    <Link to="/auth">Se connecter</Link>
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
