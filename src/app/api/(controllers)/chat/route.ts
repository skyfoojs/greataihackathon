import { NextRequest, NextResponse } from "next/server";
import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize clients
const bedrockAgentClient = new BedrockAgentRuntimeClient({
  region: process.env.REGION as string,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID as string,
    secretAccessKey: process.env.SECRET_ACCESS_KEY as string,
  }
});

const bedrockRuntimeClient = new BedrockRuntimeClient({
  region: process.env.REGION as string,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID as string,
    secretAccessKey: process.env.SECRET_ACCESS_KEY as string,
  }
});

const s3Client = new S3Client({
  region: process.env.REGION as string,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID as string,
    secretAccessKey: process.env.SECRET_ACCESS_KEY as string,
  }
});

interface KnowledgeBaseResponse {
  answer: string;
  sources: {
    s3Uri: string;
    preSignedUrl?: string;
    excerpt?: string;
  }[];
  blocked?: boolean;
  blockReason?: string;
}

async function generatePresignedUrl(s3Uri: string): Promise<string> {
  try {
    const url = new URL(s3Uri);
    const bucketName = url.hostname;
    const key = url.pathname.substring(1);

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const preSignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    return preSignedUrl;
  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    return s3Uri;
  }
}

// Function to check if content should be blocked using guardrail
async function checkWithGuardrail(content: string): Promise<{ blocked: boolean; reason?: string } | undefined> {
  try {
    const command = new ConverseCommand({
      modelId: process.env.MODEL_ID as string,
      messages: [
        {
          role: "user",
          content: [{ text: content }]
        }
      ],
      guardrailConfig: {
        guardrailIdentifier: process.env.GUARDRAIL_ID as string,
        guardrailVersion: process.env.GUARDRAIL_VERSION as string,
      },
      inferenceConfig: {
        maxTokens: 100
      }
    });

    const response = await bedrockRuntimeClient.send(command);

    // If guardrail blocks, response will indicate this
    if (response.stopReason === "guardrail_intervened") {
      return {
        blocked: true,
        reason: "Content blocked by safety guardrail"
      };
    }

    return { blocked: false };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === "GuardrailIntervened") {
        return {
          blocked: true,
          reason: error.message || "Content violates safety policies"
        };
      }
    } else {
      return {
        blocked: true,
        reason: String(error) || "Unknown error"
      }
    }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse | undefined> {
  try {
    const { question } = await request.json();
    console.log("Question send:", question);
    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    // First check the question with guardrail
    const questionCheck = await checkWithGuardrail(question);
    console.log("Question check: ", questionCheck);
    if (questionCheck && questionCheck.blocked) {
      return NextResponse.json({
        answer: "I cannot answer that question as it violates content safety policies.",
        sources: [],
        blocked: true,
        blockReason: questionCheck.reason
      });
    }

    const input = {
      input: { text: question },
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE" as const,
        knowledgeBaseConfiguration: {
          knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID as string,
          modelArn: process.env.MODEL_ARN,
          // Add guardrail configuration here
          guardrailConfiguration: {
            guardrailId: process.env.GUARDRAIL_ID,
            guardrailVersion: process.env.GUARDRAIL_VERSION,
          }
        }
      }
    };
    console.log("Input:", input);
    const command = new RetrieveAndGenerateCommand(input);
    const response = await bedrockAgentClient.send(command);
    console.log("Response: ", response);
    // Check if the response was blocked by guardrail
    if (response.guardrailAction === "INTERVENED") {
      return NextResponse.json({
        answer: "I cannot provide an answer to that question as it violates content safety policies.",
        sources: [],
        blocked: true,
        blockReason: "Response blocked by content guardrail"
      });
    }

    const answer = response.output?.text || "I couldn't find an answer to that question.";
    console.log("Answer:", answer);
    // Check the final answer with guardrail as additional safety
    const answerCheck = await checkWithGuardrail(answer);
    if (answerCheck && answerCheck.blocked) {
      return NextResponse.json({
        answer: "I cannot provide the answer as it violates content safety policies.",
        sources: [],
        blocked: true,
        blockReason: answerCheck.reason
      });
    }
    console.log("Answer check: ", answerCheck);
    // Extract citations and sources
    const sources: KnowledgeBaseResponse['sources'] = [];

    if (response.citations) {
      for (const citation of response.citations) {
        if (citation.retrievedReferences) {
          for (const reference of citation.retrievedReferences) {
            const s3Location = reference.location?.s3Location?.uri;
            const excerpt = reference.content?.text;

            if (s3Location) {
              const preSignedUrl = await generatePresignedUrl(s3Location);

              sources.push({
                s3Uri: s3Location,
                preSignedUrl,
                excerpt: excerpt?.substring(0, 200) + (excerpt && excerpt.length > 200 ? "..." : "")
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      answer,
      sources,
      blocked: false
    });

  } catch (error: unknown) {
    console.error("Error in knowledge base API:", error);

    // Handle guardrail intervention errors
    if (error instanceof Error) {
      if (error.name === "GuardrailIntervened") {
        return NextResponse.json({
          answer: "I cannot answer that question due to content safety restrictions.",
          sources: [],
          blocked: true,
          blockReason: error.message
        });
      } else {
        return NextResponse.json(
          { error: "Internal server error", details: error.message },
          { status: 500 }
        );
      }
    }
  }
}