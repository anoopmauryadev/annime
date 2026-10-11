// AWS Elemental MediaConvert: one high-quality upload in S3 becomes HLS renditions
// (360p/480p, plus 720p/1080p when the source is that large) and an original.mp4.
const { config } = require('./aws.cjs');

const ladder = [
  { name: '360p', height: 360, maxBitrate: 800000, audio: 64000 },
  { name: '480p', height: 480, maxBitrate: 1200000, audio: 96000 },
  { name: '720p', height: 720, maxBitrate: 2800000, audio: 128000 },
  { name: '1080p', height: 1080, maxBitrate: 5000000, audio: 128000 },
];
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

let client = null;
function mediaConvert() {
  if (!client) {
    const { MediaConvertClient } = require('@aws-sdk/client-mediaconvert');
    client = new MediaConvertClient({ region: config().region });
  }
  return client;
}

function h264(maxBitrate, quality) {
  return { Codec: 'H_264', H264Settings: { RateControlMode: 'QVBR', QvbrSettings: { QvbrQualityLevel: quality },
    MaxBitrate: maxBitrate, CodecProfile: 'MAIN', GopSize: 2, GopSizeUnits: 'SECONDS', GopClosedCadence: 1,
    SceneChangeDetect: 'TRANSITION_DETECTION', QualityTuningLevel: 'SINGLE_PASS_HQ' } };
}
const aac = (bitrate) => [{ CodecSettings: { Codec: 'AAC', AacSettings: { Bitrate: bitrate, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 } } }];

function renditionsFor(source) {
  const height = Number(source.height) || 1080;
  return ladder.filter((r) => r.height <= Math.max(360, height));
}

// sourceKey: videos/x.mp4; outputPrefix: hls/<dir>/  -> master.m3u8, master_360p.m3u8, original.mp4
async function createJob({ sourceKey, outputPrefix, source }) {
  const c = config();
  if (!c.mediaConvertReady) throw new Error('MediaConvert is not configured (MEDIACONVERT_ROLE_ARN)');
  const aspect = source.width && source.height ? source.width / source.height : 16 / 9;
  const renditions = renditionsFor(source);
  const { CreateJobCommand } = require('@aws-sdk/client-mediaconvert');
  const originalHeight = even(Number(source.height) || 1080);
  const job = await mediaConvert().send(new CreateJobCommand({
    Role: c.mediaConvertRole,
    UserMetadata: { app: 'annime', output: outputPrefix },
    Settings: {
      TimecodeConfig: { Source: 'ZEROBASED' },
      Inputs: [{ FileInput: `s3://${c.bucket}/${sourceKey}`, TimecodeSource: 'ZEROBASED', VideoSelector: {},
        AudioSelectors: { 'Audio Selector 1': { DefaultSelection: 'DEFAULT' } } }],
      OutputGroups: [
        { Name: 'HLS', OutputGroupSettings: { Type: 'HLS_GROUP_SETTINGS', HlsGroupSettings: {
          Destination: `s3://${c.bucket}/${outputPrefix}master`, SegmentLength: 4, MinSegmentLength: 0,
          DirectoryStructure: 'SINGLE_DIRECTORY', SegmentControl: 'SEGMENTED_FILES', OutputSelection: 'MANIFESTS_AND_SEGMENTS',
          ManifestDurationFormat: 'INTEGER', StreamInfResolution: 'INCLUDE', CodecSpecification: 'RFC_4281', ProgramDateTime: 'EXCLUDE' } },
        Outputs: renditions.map((r) => ({ NameModifier: `_${r.name}`, ContainerSettings: { Container: 'M3U8', M3u8Settings: {} },
          VideoDescription: { Width: even(r.height * aspect), Height: r.height, CodecSettings: h264(r.maxBitrate, 7) },
          AudioDescriptions: aac(r.audio) })) },
        { Name: 'Original', OutputGroupSettings: { Type: 'FILE_GROUP_SETTINGS', FileGroupSettings: { Destination: `s3://${c.bucket}/${outputPrefix}original` } },
          Outputs: [{ ContainerSettings: { Container: 'MP4', Mp4Settings: { MoovPlacement: 'PROGRESSIVE_DOWNLOAD' } },
            VideoDescription: { Width: even(originalHeight * aspect), Height: originalHeight, CodecSettings: h264(originalHeight >= 1440 ? 12000000 : 8000000, 9) },
            AudioDescriptions: aac(128000) }] },
      ],
    },
  }));
  return { id: job.Job.Id, renditions: renditions.map((r) => r.name) };
}

async function getJob(id) {
  const { GetJobCommand } = require('@aws-sdk/client-mediaconvert');
  const { Job } = await mediaConvert().send(new GetJobCommand({ Id: id }));
  return { status: Job.Status, percent: Job.JobPercentComplete || 0, error: Job.ErrorMessage || '' };
}

async function cancelJob(id) {
  const { CancelJobCommand } = require('@aws-sdk/client-mediaconvert');
  await mediaConvert().send(new CancelJobCommand({ Id: id }));
}

module.exports = { createJob, getJob, cancelJob, renditionsFor };
