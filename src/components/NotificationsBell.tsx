import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { notificationApi, type Notification } from "@/features/notifications/api";
import { queryKeys } from "@/app/query";

export function NotificationsBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications(user?.id),
    enabled: Boolean(user),
    queryFn: async (): Promise<Notification[]> => notificationApi.list(),
    refetchInterval: 30_000,
  });

  if (!user) return null;

  const items = notificationsQuery.data ?? [];
  const unread = items.filter((item) => !item.readAt);

  const markAllRead = async () => {
    if (unread.length === 0) return;
    await Promise.all(unread.map((item) => notificationApi.markRead(item.id)));
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user.id) });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" aria-hidden />
          {unread.length > 0 ? (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          {unread.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
              Tout marquer lu
            </Button>
          ) : null}
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Aucune notification pour l'instant. Vous serez averti dès qu'un cadeau est réservé.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{item.title}</p>
                    {!item.readAt ? <Badge className="shrink-0">Nouveau</Badge> : null}
                  </div>
                  {item.body ? (
                    <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("fr-BE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
