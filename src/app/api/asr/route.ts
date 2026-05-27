import { NextRequest, NextResponse } from 'next/server';
import { ASRClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let audioBase64: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const audioFile = formData.get('audio') as File | null;
      if (!audioFile) {
        return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
      }
      const arrayBuffer = await audioFile.arrayBuffer();
      audioBase64 = Buffer.from(arrayBuffer).toString('base64');
    } else {
      const body = await request.json();
      audioBase64 = body.base64Data;
      if (!audioBase64) {
        return NextResponse.json({ error: 'No audio data provided' }, { status: 400 });
      }
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new ASRClient(config, customHeaders);

    const result = await client.recognize({
      uid: 'daily-review-user',
      base64Data: audioBase64,
    });

    return NextResponse.json({
      text: result.text,
      duration: result.duration,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'ASR failed';
    console.error('[ASR Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
