import { TrashIcon } from "@sanity/icons";
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Heading,
  Inline,
  Select,
  Stack,
  Text,
  TextInput,
  useToast,
} from "@sanity/ui";
import { useEffect, useMemo, useState } from "react";
import { useClient } from "sanity";

const apiVersion = "2025-02-19";

const documentTypes = [
  { label: "Products", value: "product" },
  { label: "Categories", value: "category" },
  { label: "Collections", value: "collection" },
  { label: "Colours", value: "colour" },
  { label: "Materials", value: "material" },
];

function getTitle(doc) {
  return doc.name || doc.title || doc.productKey || doc._id;
}

function canDelete(doc, type) {
  return type === "product" || doc.referenceCount === 0;
}

function SafeDeleteTool() {
  const client = useClient({ apiVersion });
  const toast = useToast();
  const [type, setType] = useState("product");
  const [documents, setDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [query, setQuery] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  async function loadDocuments(nextType = type) {
    setLoading(true);
    setSelectedIds([]);
    setConfirmation("");

    try {
      const docs = await client.fetch(
        `*[_type == $type && !(_id in path("drafts.**"))] | order(title asc, name asc) {
          _id,
          _type,
          title,
          name,
          productKey,
          "slug": slug.current,
          "referenceCount": count(*[_type == "product" && references(^._id)])
        }`,
        { type: nextType },
      );
      setDocuments(docs);
    } catch (error) {
      toast.push({
        status: "error",
        title: "Could not load documents",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments(type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return documents;
    }

    return documents.filter((doc) =>
      [getTitle(doc), doc.productKey, doc.slug, doc._id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [documents, query]);

  const selectedDocuments = documents.filter((doc) => selectedIds.includes(doc._id));
  const blockedSelected = selectedDocuments.filter((doc) => !canDelete(doc, type));
  const readyToDelete =
    selectedDocuments.length > 0 &&
    blockedSelected.length === 0 &&
    confirmation === "DELETE" &&
    !deleting;

  function toggleSelected(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleAllVisible() {
    const deletableVisibleIds = filteredDocuments
      .filter((doc) => canDelete(doc, type))
      .map((doc) => doc._id);
    const allVisibleSelected = deletableVisibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !deletableVisibleIds.includes(id))
        : Array.from(new Set([...current, ...deletableVisibleIds])),
    );
  }

  async function deleteSelected() {
    if (!readyToDelete) {
      return;
    }

    setDeleting(true);

    try {
      let transaction = client.transaction();
      for (const id of selectedIds) {
        transaction = transaction.delete(id).delete(`drafts.${id}`);
      }
      await transaction.commit();

      toast.push({
        status: "success",
        title: "Documents deleted",
        description: `${selectedIds.length} document${selectedIds.length === 1 ? "" : "s"} deleted.`,
      });
      await loadDocuments(type);
    } catch (error) {
      toast.push({
        status: "error",
        title: "Delete failed",
        description: error.message,
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card height="fill" overflow="auto" padding={4}>
      <Stack space={4}>
        <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
          <Stack space={2}>
            <Heading size={3}>Safe Delete</Heading>
            <Text muted size={1}>
              Select documents carefully. Referenced categories, collections, colours, and materials are blocked.
            </Text>
          </Stack>
          <Button disabled={loading} mode="ghost" onClick={() => loadDocuments(type)} text="Refresh" />
        </Flex>

        <Flex gap={3} wrap="wrap">
          <Box style={{ minWidth: 220 }}>
            <Select
              onChange={(event) => setType(event.currentTarget.value)}
              value={type}
            >
              {documentTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Box>
          <Box flex={1} style={{ minWidth: 260 }}>
            <TextInput
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search by name, slug, SKU key, or ID"
              value={query}
            />
          </Box>
        </Flex>

        <Card border padding={3} radius={2} tone={blockedSelected.length > 0 ? "caution" : "transparent"}>
          <Flex align="center" justify="space-between" gap={3} wrap="wrap">
            <Inline space={3}>
              <Badge tone="primary">{selectedDocuments.length} selected</Badge>
              <Badge>{filteredDocuments.length} shown</Badge>
              {blockedSelected.length > 0 ? (
                <Badge tone="critical">{blockedSelected.length} blocked</Badge>
              ) : null}
            </Inline>
            <Inline space={3}>
              <TextInput
                onChange={(event) => setConfirmation(event.currentTarget.value)}
                placeholder='Type "DELETE"'
                value={confirmation}
              />
              <Button
                disabled={!readyToDelete}
                icon={TrashIcon}
                loading={deleting}
                onClick={deleteSelected}
                text="Delete selected"
                tone="critical"
              />
            </Inline>
          </Flex>
        </Card>

        <Card border radius={2}>
          <Stack>
            <Card borderBottom padding={3}>
              <Flex align="center" gap={3}>
                <Checkbox
                  checked={
                    filteredDocuments.length > 0 &&
                    filteredDocuments
                      .filter((doc) => canDelete(doc, type))
                      .every((doc) => selectedIds.includes(doc._id))
                  }
                  onChange={toggleAllVisible}
                />
                <Text weight="semibold">
                  {loading ? "Loading..." : `${filteredDocuments.length} document${filteredDocuments.length === 1 ? "" : "s"}`}
                </Text>
              </Flex>
            </Card>

            {filteredDocuments.map((doc) => {
              const blocked = !canDelete(doc, type);
              return (
                <Card borderBottom key={doc._id} padding={3} tone={blocked ? "caution" : "transparent"}>
                  <Flex align="center" gap={3}>
                    <Checkbox
                      checked={selectedIds.includes(doc._id)}
                      disabled={blocked}
                      onChange={() => toggleSelected(doc._id)}
                    />
                    <Box flex={1}>
                      <Stack space={2}>
                        <Text weight="semibold">{getTitle(doc)}</Text>
                        <Text muted size={1}>
                          {[doc.productKey, doc.slug, doc._id].filter(Boolean).join(" - ")}
                        </Text>
                      </Stack>
                    </Box>
                    {type === "product" ? (
                      <Badge tone={doc.referenceCount > 0 ? "caution" : "default"}>
                        {doc.referenceCount} references
                      </Badge>
                    ) : (
                      <Badge tone={blocked ? "critical" : "positive"}>
                        {doc.referenceCount} product references
                      </Badge>
                    )}
                  </Flex>
                </Card>
              );
            })}

            {!loading && filteredDocuments.length === 0 ? (
              <Card padding={4}>
                <Text muted>No documents found.</Text>
              </Card>
            ) : null}
          </Stack>
        </Card>
      </Stack>
    </Card>
  );
}

export const safeDeleteTool = {
  name: "safe-delete",
  title: "Safe Delete",
  icon: TrashIcon,
  component: SafeDeleteTool,
};
