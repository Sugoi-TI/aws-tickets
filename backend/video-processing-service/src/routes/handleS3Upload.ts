import { GetCommand } from "@aws-sdk/lib-dynamodb";
import BitmovinApi, {
  CloudRegion,
  S3Input,
  S3Output,
  Encoding,
  StreamInput,
  Stream,
  EncodingOutput,
  AclEntry,
  AclPermission,
  H264VideoConfiguration,
  AacAudioConfiguration,
  PresetConfiguration,
  MuxingStream,
  StreamSelectionMode,
  Fmp4Muxing,
  HlsManifest,
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
} from "../utils";

const STATUS: { PROCESSING: VideoStatus; FAILED: VideoStatus } = {
  PROCESSING: "PROCESSING",
  FAILED: "FAILED",
};

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
    const videoId = fileName.split("-")[0];

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
        selectionMode: StreamSelectionMode.AUTO,
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
        selectionMode: StreamSelectionMode.AUTO,
        position: 0,
      });

      const audioStream = await bitmovin.encoding.encodings.streams.create(
        encoding.id!,
        new Stream({
          inputStreams: [audioStreamInput],
          codecConfigId: audioCodecConfig.id,
        }),
      );

      console.log("Created audio stream:", audioStream.id);

      const aclEntry = new AclEntry({
        permission: AclPermission.PUBLIC_READ,
      });

      const encodingOutput = new EncodingOutput({
        outputPath: `processed-outputs/${videoId}/`,
        outputId: output.id,
        acl: [aclEntry],
      });

      await bitmovin.encoding.encodings.muxings.fmp4.create(
        encoding.id!,
        new Fmp4Muxing({
          outputs: [encodingOutput],
          streams: [
            new MuxingStream({ streamId: videoStream.id }),
            new MuxingStream({ streamId: audioStream.id }),
          ],
          segmentLength: 4,
        }),
      );

      console.log("Created fMP4 muxing");

      await bitmovin.encoding.manifests.hls.create(
        new HlsManifest({
          name: `manifest-${videoId}`,
          outputs: [encodingOutput],
        }),
      );

      console.log("Created HLS manifest");

      await bitmovin.encoding.encodings.start(encoding.id!);

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
