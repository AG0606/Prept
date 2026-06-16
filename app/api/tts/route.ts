import { NextRequest, NextResponse } from 'next/server';
import { EdgeTTS } from 'node-edge-tts';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      text, 
      voice = 'en-US-AvaMultilingualNeural', 
      rate = 'default', 
      pitch = 'default', 
      volume = 'default' 
    } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Determine the lang from voice name (e.g. en-US-AvaMultilingualNeural -> en-US)
    const lang = voice.includes('-') ? voice.split('-').slice(0, 2).join('-') : 'en-US';
    const tempFile = path.join(os.tmpdir(), `lumen-tts-${crypto.randomUUID()}.mp3`);

    try {
      const tts = new EdgeTTS({
        voice,
        lang,
        rate,
        pitch,
        volume,
      });

      await tts.ttsPromise(text, tempFile);
      const audioBuffer = await fs.readFile(tempFile);

      // Clean up temp file asynchronously
      await fs.unlink(tempFile).catch(() => {});

      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.length.toString(),
        },
      });
    } catch (innerError) {
      // Ensure cleanup on failure
      await fs.unlink(tempFile).catch(() => {});
      throw innerError;
    }
  } catch (error: any) {
    console.error('TTS generation failed:', error);
    return NextResponse.json({ error: error.message || 'TTS generation failed' }, { status: 500 });
  }
}

