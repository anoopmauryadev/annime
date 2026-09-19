param([int]$WorkerPid,[int]$InitialRate)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CpuJob {
 [StructLayout(LayoutKind.Sequential)] public struct Rate { public uint Flags; public uint Value; }
 [StructLayout(LayoutKind.Sequential)] public struct Basic { public long ProcessTime,JobTime; public uint Flags; public UIntPtr MinWorkingSet,MaxWorkingSet; public uint ActiveProcesses; public UIntPtr Affinity; public uint Priority,Scheduling; }
 [StructLayout(LayoutKind.Sequential)] public struct Counters { public ulong ReadOps,WriteOps,OtherOps,ReadBytes,WriteBytes,OtherBytes; }
 [StructLayout(LayoutKind.Sequential)] public struct Extended { public Basic Basic; public Counters Io; public UIntPtr ProcessMemory,JobMemory,PeakProcessMemory,PeakJobMemory; }
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern IntPtr CreateJobObject(IntPtr a,string name);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool SetInformationJobObject(IntPtr job,int cls,ref Rate info,uint size);
 [DllImport("kernel32.dll", EntryPoint="SetInformationJobObject", SetLastError=true)] public static extern bool SetExtended(IntPtr job,int cls,ref Extended info,uint size);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
 public static void Set(IntPtr job,uint value) { var r=new Rate { Flags=5, Value=value }; if(!SetInformationJobObject(job,15,ref r,8))throw new System.ComponentModel.Win32Exception(); }
 public static void KillOnClose(IntPtr job) { var e=new Extended(); e.Basic.Flags=0x2000; if(!SetExtended(job,9,ref e,(uint)Marshal.SizeOf(typeof(Extended))))throw new System.ComponentModel.Win32Exception(); }
}
'@
$job=[CpuJob]::CreateJobObject([IntPtr]::Zero,$null)
$process=[CpuJob]::OpenProcess(0x101,$false,$WorkerPid)
if($job -eq [IntPtr]::Zero -or $process -eq [IntPtr]::Zero){throw 'Cannot create CPU job'}
try {
 [CpuJob]::Set($job,[uint32]$InitialRate)
 [CpuJob]::KillOnClose($job)
 if(-not [CpuJob]::AssignProcessToJobObject($job,$process)){throw 'Cannot assign worker to CPU job'}
 [Console]::WriteLine('READY')
 while($null -ne ($line=[Console]::ReadLine())){[uint32]$rate=0;if(-not [uint32]::TryParse($line,[ref]$rate) -or $rate -lt 1 -or $rate -gt 10000){throw 'Invalid quota'};[CpuJob]::Set($job,$rate)}
} finally {[CpuJob]::CloseHandle($process)|Out-Null;[CpuJob]::CloseHandle($job)|Out-Null}
