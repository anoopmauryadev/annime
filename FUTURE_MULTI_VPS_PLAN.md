# Hindi Anime Zone — Future multi-VPS plan

Saved: 10 September 2026

Status: Planning only. Multi-server implementation and deployment have not started.

## Owner's requirements and budget

- Existing main AWS VPS plus four additional VPS of the same configuration: five total.
- Reported configuration: t3.2xlarge, 8 vCPU, 32 GiB RAM, approximately 1 TB disk per VPS. Verify actual configuration before deployment.
- AWS VPS/bandwidth budget is available. A paid CDN is not required for the initial design.
- Serve free viewers at 360p/480p from the VPS cluster.
- Original Quality and future HD renditions require a logged-in VIP account.
- Bunny integration remains available in the code for future work. VIP delivery through Bunny is optional and deferred; VIP videos can also be served by the VPS cluster.
- Start with a target of 300 simultaneous viewers. This is a test target, not a measured capacity or guarantee.
- Complete the current single-VPS playback update separately before starting this plan.

## Current work versus future work

The current local playback update covers key-before-login, an admin login requirement toggle, guest view counting, free 360p/480p, VIP Original Quality, and publishing finished 360p before the remaining conversion completes. Deployment instructions are in [PLAYBACK_DEPLOYMENT.md](PLAYBACK_DEPLOYMENT.md).

Do not assume those local changes are already pushed or deployed. Check repository and VPS state when work resumes. The future cluster must preserve these access rules and the existing intro animation and upload/transcoding controls.

## Proposed server roles

| Server | Primary responsibilities |
| --- | --- |
| Main VPS | Website, admin panel, authentication, guest keys, VIP checks, database, job scheduler and media-server selection |
| Media VPS 1–4 | Serve prepared video files; run transcoding jobs within configured resource limits |

Playback bytes should travel directly from the selected media VPS to the viewer. Routing all video through the main VPS would keep its network as a bottleneck.

The main VPS/database remains a single point of failure in this first version. Media failover does not solve main-app outages; app/database high availability is a separate later stage.

## Upload and distributed transcoding

1. Admin uploads through the main website.
2. If auto-transcoding is OFF, store the upload without silently queuing it later when the toggle changes.
3. If ON, create durable, independent jobs for 360p and 480p, plus browser-compatible Original Quality. Add a 720p job later only when explicitly enabled for VIP.
4. Transfer the source to a suitable worker. Verify that transfer finished before processing.
5. Workers claim jobs through a central authenticated queue. One worker owns each rendition job at a time.
6. Prefer 360p first for the earliest free playback; schedule remaining renditions as resources allow.
7. Publish a completed rendition atomically. It becomes available before the other renditions finish.
8. Replicate prepared files to the selected serving nodes. Mark each node/rendition ready only after transfer and verification.
9. Update the episode's available qualities. A failed or incomplete Original conversion must not remove already-ready 360p/480p.

Do not permanently bind 360p to Server 1, 480p to Server 2 and 720p to Server 3. Any enabled worker with capacity should be able to claim a supported job. Parallel jobs for different renditions of the same source are allowed.

Use job leases, worker heartbeats, bounded retries and idempotent publication so a worker restart does not lose a job or overwrite a rendition currently being watched. Nodes should use authenticated APIs rather than independently writing or syncing the live SQLite database. Choose the queue implementation during implementation.

## Storage and file availability

- Track source location, prepared renditions, file version/checksum and which nodes have each rendition.
- Keep enough replicas of popular videos for load distribution and failure recovery. Initially consider two replicas; increase for hot content.
- Do not assume each node must store the whole library. Final replication policy depends on library size and actual disk capacity.
- Limit replication bandwidth and disk I/O so copying uploads does not degrade playback.
- A server with spare CPU but without the episode files is not a valid playback destination.
- Failover replicas must contain matching rendition versions and segment paths.
- Keep at least one durable source copy and backups; define deletion/retention separately before any automated cleanup is enabled.

## Load-aware playback routing

Check all of the following when assigning a new session:

- Node health and recent heartbeat.
- Requested episode/quality readiness.
- Sustained network usage and remaining serving capacity.
- Segment response times, timeouts and playback buffering signals.
- Disk latency/I/O pressure, CPU and memory pressure.
- Active playback sessions, counting session heartbeats rather than raw HTTP connections.

Keep a viewer on the selected node during normal playback. Prefer sending new viewers elsewhere when load grows. Move existing playback only on failure or persistent degradation, preserve playback position and issue valid access for the replacement node. Switching cannot guarantee zero interruption.

When all nodes are saturated, slow or pause background work and stop assigning more sessions than the tested limits allow. Load balancing does not create bandwidth or file replicas.

## Playback priority and CPU adjustment

- Give transcoding lower scheduling priority than website/video serving.
- Enforce worker CPU quotas in addition to FFmpeg thread limits; thread count and `nice` alone are not hard CPU caps.
- Limit simultaneous jobs per node and source-transfer traffic.
- On sustained playback degradation, lower worker quota and stop new jobs. If necessary, pause active processing with safe resume/retry behavior.
- Restore capacity only after a sustained recovery period. Use separate high/low thresholds and cooldowns to avoid rapid pause/resume oscillation.
- Monitor disk and network pressure too; lowering CPU alone does not solve those bottlenecks.
- Track t3 CPU credits and surplus credits. AWS budget availability does not remove burst-mode behavior or the need to monitor it.
- Tune actual thresholds after measurement, rather than treating arbitrary CPU percentages as proven safe settings.

## Access protection

- Preserve the current order: key verification when enabled, optional login requirement, intro, then video.
- Guest keys unlock only permitted free qualities. VIP must be checked against current account status.
- Protect playlists, segments, Original files and downloads at every media node. UI hiding is insufficient.
- Issue short-lived media authorization scoped to the permitted asset/quality. Do not issue a free directory token that also grants access to a VIP original stored in the same folder.
- Handle authorization renewal during long videos and failover; define revocation behavior explicitly.
- No public static-media path should bypass authentication. CORS/referer checks are not substitutes for access authorization.
- Keep worker credentials and media signing secrets server-side; restrict node administration and transfer endpoints.

## Admin monitoring and controls

| Display | Controls |
| --- | --- |
| Server online/offline, last heartbeat | Enable/disable new playback assignments |
| CPU, RAM, disk space and I/O, network throughput | Drain a node while existing sessions continue |
| Active sessions, slow segments and failures | Per-node tested session limit |
| Running/pending/failed jobs and progress | Transcoding ON/OFF per node and globally |
| Episode/rendition location and replica readiness | Retry failed jobs; pause/resume background processing |
| Worker resource usage and AWS CPU-credit metrics | CPU quota, job concurrency and enabled rendition profiles |

Retain the existing key system and login ON/OFF controls. Distinguish stopping new transcode jobs from pausing active jobs. Disabling new viewer assignments should not abruptly terminate all current viewers. Record administrative changes and failures for diagnosis.

## Capacity assumptions and acceptance tests

Current configured encoding targets:

| Quality | Video + audio bitrate | Approximate delivery planning allowance per viewer |
| --- | --- | --- |
| 360p | 800 + 64 Kbps | 0.95–1 Mbps |
| 480p | 1200 + 96 Kbps | 1.4–1.5 Mbps |

300 simultaneous 480p viewers therefore need approximately 420–450 Mbps of aggregate delivery capacity. A roughly 600 Mbps sustained usable cluster budget provides some headroom. Source transfers, replication, VIP originals and downloads require additional capacity. These numbers are traffic estimates, not server benchmarks.

With four media nodes, 300 viewers average 75 viewers/node. With one node unavailable, the remaining three need approximately 100 viewers/node and the required file replicas. Uneven popularity can prevent an even split.

Validate progressively at 100, 200 and 300 simultaneous viewers:

- Use multiple independent load-generator machines/networks; a single laptop can be the bottleneck.
- Test sustained playback beyond short bandwidth/CPU bursts, across several different episodes.
- Include seeking, starting together, mixed qualities, cold files and popular episodes.
- Run transcoding and file replication during the test.
- Test loss/drain of a media node, expired tokens and access revocation.
- Measure time to start, segment latency relative to segment duration, buffering, error rate, network usage, disk pressure and main-app/database latency.
- Set public capacity limits from the measured results, including failure headroom. Increase the target only after passing at the preceding level.

No measured maximum is currently established. 300 is a reasonable initial engineering target; neither 100 viewers per VPS nor a fixed fivefold scaling is guaranteed.

## Implementation stages when authorized

1. Confirm current single-VPS deployment, node inventory, network placement, disk capacity, domain/DNS and secure node access.
2. Add one protected media node and verify file transfer, access rules and direct playback.
3. Add node health, file-readiness tracking, session assignment and safe failover.
4. Add the remaining media nodes and bounded distributed transcoding.
5. Add resource adjustment and admin controls/monitoring.
6. Run the capacity and failure tests; document the measured operating limits.
7. Consider optional VIP Bunny delivery and main-app/database high availability separately.

## References checked during planning

- [AWS CPU baseline and credit concepts](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-credits-baseline-concepts.html)
- [AWS Unlimited mode](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-performance-instances-unlimited-mode-concepts.html)
- [AWS network bandwidth](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-network-bandwidth.html)

Recheck provider details when implementing. Do not treat this document as evidence that the cluster is already installed or tested.
