import { GetCommand } from "@aws-sdk/lib-dynamodb";
import BitmovinApiModule, {
  CloudRegion,
  S3Input,
  S3Output,
  Encoding,
  StreamInput,
  Stream,
  EncodingOutput,
  H264VideoConfiguration,
  AacAudioConfiguration,
  PresetConfiguration,
  MuxingStream,
  StreamSelectionMode,
  Fmp4Muxing,
  HlsManifest,
  AudioMediaInfo,
  StreamInfo,
  StartEncodingRequest,
  ManifestGenerator,
  ManifestResource,
  Webhook,
  WebhookHttpMethod,
} from "@bitmovin/api-sdk";
import { type VideoStatus } from "@my-app/shared";
import {
  VIDEO_TABLE_NAME,
  BITMOVIN_API_KEY,
  BITMOVIN_ACCESS_KEY,
  BITMOVIN_SECRET_ACCESS_KEY,
  docClient,
  updateVideoStatus,
  VIDEO_BUCKET_NAME,
  WEBHOOK_URL,
} from "../utils";

const STATUS: { PROCESSING: VideoStatus; FAILED: VideoStatus } = {
  PROCESSING: "PROCESSING",
  FAILED: "FAILED",
};

const BitmovinApi = (BitmovinApiModule as any).default || BitmovinApiModule;
const bitmovin = new BitmovinApi({ apiKey: BITMOVIN_API_KEY });

export async function handleS3UploadEvent(records: Array<{ s3: { object: { key: string } } }>) {
  console.log("Received S3 event:", JSON.stringify(records, null, 2));

  for (const record of records) {
    const s3Key = decodeURIComponent(record.s3.object.key);

    if (!s3Key.startsWith("raw-uploads/")) {
      console.log("Skipping non-raw-upload file:", s3Key);
      continue;
    }

    const fileName = s3Key.split("/")[1];
    const videoId = fileName.split("__")[0];

    console.log("Processing video:", videoId, "s3Key:", s3Key);

    try {
      const videoResult = await docClient.send(
        new GetCommand({
          TableName: VIDEO_TABLE_NAME,
          Key: { pk: `VIDEO#${videoId}`, sk: "META" },
        }),
      );

      if (!videoResult.Item) {
        console.error("Video not found:", videoId);
        continue;
      }

      await updateVideoStatus(videoId, STATUS.PROCESSING);

      const input = await bitmovin.encoding.inputs.s3.create(
        new S3Input({
          name: `input-${videoId}`,
          bucketName: VIDEO_BUCKET_NAME,
          accessKey: BITMOVIN_ACCESS_KEY,
          secretKey: BITMOVIN_SECRET_ACCESS_KEY,
        }),
      );

      console.log("Created input:", input.id);

      const output = await bitmovin.encoding.outputs.s3.create(
        new S3Output({
          name: `output-${videoId}`,
          bucketName: VIDEO_BUCKET_NAME,
          accessKey: BITMOVIN_ACCESS_KEY,
          secretKey: BITMOVIN_SECRET_ACCESS_KEY,
        }),
      );

      console.log("Created output:", output.id);

      const videoCodecConfig = await bitmovin.encoding.configurations.video.h264.create(
        new H264VideoConfiguration({
          name: `video-${videoId}`,
          presetConfiguration: PresetConfiguration.VOD_STANDARD,
          height: 720,
          bitrate: 2000000,
        }),
      );

      console.log("Created video codec config:", videoCodecConfig.id);

      const audioCodecConfig = await bitmovin.encoding.configurations.audio.aac.create(
        new AacAudioConfiguration({
          name: `audio-${videoId}`,
          bitrate: 128000,
        }),
      );

      console.log("Created audio codec config:", audioCodecConfig.id);

      const encoding = await bitmovin.encoding.encodings.create(
        new Encoding({
          name: `encoding-${videoId}`,
          cloudRegion: CloudRegion.AWS_EU_CENTRAL_1,
        }),
      );

      console.log("Created encoding:", encoding.id);

      const videoStreamInput = new StreamInput({
        inputId: input.id,
        inputPath: s3Key,
        selectionMode: StreamSelectionMode.VIDEO_RELATIVE,
      });

      const videoStream = await bitmovin.encoding.encodings.streams.create(
        encoding.id!,
        new Stream({
          inputStreams: [videoStreamInput],
          codecConfigId: videoCodecConfig.id,
        }),
      );

      console.log("Created video stream:", videoStream.id);

      const audioStreamInput = new StreamInput({
        inputId: input.id,
        inputPath: s3Key,
        selectionMode: StreamSelectionMode.AUDIO_RELATIVE,
      });

      const audioStream = await bitmovin.encoding.encodings.streams.create(
        encoding.id!,
        new Stream({
          inputStreams: [audioStreamInput],
          codecConfigId: audioCodecConfig.id,
        }),
      );

      console.log("Created audio stream:", audioStream.id);

      const videoOutput = new EncodingOutput({
        outputPath: `processed-outputs/${videoId}/video/`,
        outputId: output.id,
      });

      const audioOutput = new EncodingOutput({
        outputPath: `processed-outputs/${videoId}/audio/`,
        outputId: output.id,
      });

      const manifestOutput = new EncodingOutput({
        outputPath: `processed-outputs/${videoId}/`,
        outputId: output.id,
      });

      const videoMuxing = await bitmovin.encoding.encodings.muxings.fmp4.create(
        encoding.id!,
        new Fmp4Muxing({
          outputs: [videoOutput],
          streams: [new MuxingStream({ streamId: videoStream.id })],
          segmentLength: 4,
        }),
      );

      console.log("Created Video fMP4 muxing");

      const audioMuxing = await bitmovin.encoding.encodings.muxings.fmp4.create(
        encoding.id!,
        new Fmp4Muxing({
          outputs: [audioOutput],
          streams: [new MuxingStream({ streamId: audioStream.id })],
          segmentLength: 4,
        }),
      );

      console.log("Created Audio fMP4 muxing");

      const hlsManifest = await bitmovin.encoding.manifests.hls.create(
        new HlsManifest({
          name: `manifest-${videoId}`,
          manifestName: "master.m3u8",
          outputs: [manifestOutput],
        }),
      );

      console.log("Created HLS manifest base");

      await bitmovin.encoding.manifests.hls.media.audio.create(
        hlsManifest.id!,
        new AudioMediaInfo({
          name: "Audio Track",
          groupId: "audio_group",
          segmentPath: "audio",
          encodingId: encoding.id!,
          streamId: audioStream.id!,
          muxingId: audioMuxing.id!,
          language: "en",
          uri: "audio.m3u8",
        }),
      );

      console.log("Attached audio to manifest");

      await bitmovin.encoding.manifests.hls.streams.create(
        hlsManifest.id!,
        new StreamInfo({
          audio: "audio_group",
          segmentPath: "video",
          encodingId: encoding.id!,
          streamId: videoStream.id!,
          muxingId: videoMuxing.id!,
          uri: "video.m3u8",
        }),
      );

      console.log("Attached video to manifest");

      if (WEBHOOK_URL) {
        await bitmovin.notifications.webhooks.encoding.encodings.finished.createByEncodingId(
          encoding.id!,
          new Webhook({
            url: WEBHOOK_URL,
            method: WebhookHttpMethod.POST,
          }),
        );

        await bitmovin.notifications.webhooks.encoding.encodings.error.createByEncodingId(
          encoding.id!,
          new Webhook({
            url: WEBHOOK_URL,
            method: WebhookHttpMethod.POST,
          }),
        );

        console.log("Attached webhooks to encoding");
      }

      const startEncodingRequest = new StartEncodingRequest({
        manifestGenerator: ManifestGenerator.V2,
        vodHlsManifests: [new ManifestResource({ manifestId: hlsManifest.id! })],
      });

      await bitmovin.encoding.encodings.start(encoding.id!, startEncodingRequest);

      console.log("Started encoding for video:", videoId, "encodingId:", encoding.id);
    } catch (e) {
      console.error("Error processing video:", videoId, e);
      await updateVideoStatus(videoId, STATUS.FAILED, {
        errorMessage: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return { statusCode: 200, body: "OK" };
}
