import { NextResponse } from 'next/server';
import { BedrockAgentClient, StartIngestionJobCommand } from "@aws-sdk/client-bedrock-agent";

export async function POST() {
  try {
    // Initialize Bedrock client
    const client = new BedrockAgentClient({
      region: process.env.REGION as string,
      credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID as string,
        secretAccessKey: process.env.SECRET_ACCESS_KEY as string,
      }
    });

    const command = new StartIngestionJobCommand({
      knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID as string,
      dataSourceId: process.env.DATA_SOURCE_ID as string,
    });

    const response = await client.send(command);
    console.log(response)
    return NextResponse.json({
      success: true,
      jobId: response.ingestionJob?.ingestionJobId
    });
  } catch (error) {
    console.error('Ingestion error:', error);
    return NextResponse.json(
      { error: 'Failed to start ingestion job' },
      { status: 500 }
    );
  }
}