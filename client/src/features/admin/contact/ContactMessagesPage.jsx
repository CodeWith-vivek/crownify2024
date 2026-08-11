import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { adminApi } from "../adminApi";

export function ContactMessagesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-contact-messages", page, search],
    queryFn: () => adminApi.contactMessages(page, search),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold text-primary">Contact Messages</h1>
        <Input
          placeholder="Search messages..."
          className="max-w-xs"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading ? (
        <Skeleton className="mt-6 h-96 w-full" />
      ) : (
        <div className="mt-6 space-y-3">
          {data?.messages?.map((m) => (
            <Card key={m._id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(m.submittedOn).toLocaleString()}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {m.email} · {m.phone}
                </p>
                <p className="mt-2 text-sm">{m.message}</p>
              </CardContent>
            </Card>
          ))}
          {!data?.messages?.length && <p className="text-sm text-muted-foreground">No messages found.</p>}
        </div>
      )}

      {data?.totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: data.totalPages }).map((_, i) => (
            <Button key={i} size="sm" variant={data.currentPage === i + 1 ? "default" : "outline"} onClick={() => setPage(i + 1)}>
              {i + 1}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
