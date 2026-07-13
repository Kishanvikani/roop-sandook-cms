import { UploadIcon } from "@sanity/icons";
import { Box, Button, Card, Flex, Stack, Text, useToast } from "@sanity/ui";
import { insert, PatchEvent, setIfMissing, useClient } from "sanity";
import { useRef, useState } from "react";

function makeImage(asset) {
  return {
    _key: `image-${asset._id.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    _type: "image",
    asset: {
      _type: "reference",
      _ref: asset._id,
    },
  };
}

export function MultiImageUploadInput(props) {
  const { onChange, readOnly, renderDefault } = props;
  const client = useClient({ apiVersion: "2025-02-19" });
  const toast = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files) {
    const imageFiles = Array.from(files || []).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) {
      toast.push({
        status: "warning",
        title: "Choose image files",
        description: "Only image files can be uploaded here.",
      });
      return;
    }

    setUploading(true);

    try {
      const uploaded = [];
      for (const file of imageFiles) {
        const asset = await client.assets.upload("image", file, {
          filename: file.name,
        });
        uploaded.push(makeImage(asset));
      }

      onChange(
        PatchEvent.from(setIfMissing([])).append(insert(uploaded, "after", [-1])),
      );

      toast.push({
        status: "success",
        title: "Images uploaded",
        description: `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} added.`,
      });
    } catch (error) {
      toast.push({
        status: "error",
        title: "Upload failed",
        description: error.message,
      });
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <Stack space={3}>
      {renderDefault(props)}
      <Card border padding={3} radius={2} tone="transparent">
        <Flex align="center" gap={3} wrap="wrap">
          <Box flex={1}>
            <Text muted size={1}>
              Upload several product images at once. They will be added to the image list above.
            </Text>
          </Box>
          <Button
            disabled={readOnly || uploading}
            icon={UploadIcon}
            mode="ghost"
            onClick={() => inputRef.current?.click()}
            text={uploading ? "Uploading..." : "Upload images"}
            tone="primary"
          />
          <input
            accept="image/*"
            hidden
            multiple
            onChange={(event) => handleFiles(event.currentTarget.files)}
            ref={inputRef}
            type="file"
          />
        </Flex>
      </Card>
    </Stack>
  );
}
