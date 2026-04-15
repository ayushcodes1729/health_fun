import {
  AnchorIdl,
  rootNodeFromAnchorWithoutDefaultVisitor,
} from "@codama/nodes-from-anchor";
import { renderJavaScriptUmiVisitor } from "@codama/renderers";
import { visit } from "@codama/visitors-core";
import anchorIdl from "../target/idl/health_fun.json";

async function generateClient() {
  const rootNode = rootNodeFromAnchorWithoutDefaultVisitor(
    anchorIdl as AnchorIdl,
  ) as unknown as Parameters<typeof visit>[0];
  const renderVisitor =
    (await renderJavaScriptUmiVisitor(
      "clients/generated/umi/src",
    )) as unknown as Parameters<typeof visit>[1];

  await visit(rootNode, renderVisitor);

  console.log("Generated Codama Umi client in clients/generated/umi/src");
}

void generateClient();
