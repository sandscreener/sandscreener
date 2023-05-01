import { MultiBar, Presets, SingleBar } from 'cli-progress';
import { Service, MemoryServiceOptions } from 'feathers-memory';
import { Application } from '../../declarations';

export class ProgressIndicator extends Service {
  progress: MultiBar;
  //Map of progress bars by pool name
  bars: Map<string, SingleBar> = new Map();
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<MemoryServiceOptions>, app: Application) {
    super(options);
    this.progress = new MultiBar(
      {
        clearOnComplete: false,
        hideCursor: true,
        noTTYOutput: true,
      },
      Presets.shades_grey
    );
  }

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(data: any, params?: any): Promise<any> {
    if (process.env.NODE_ENV === 'test') {
      return data;
    }
    const singleBar = this.progress.create(
      (data.sanctionedAt - data.createdAt) / 2000,
      0,
      {
        block: 0,
        totalBlocks: data.sanctionedAt - data.createdAt,
        tx: 0,
      },
      {
        format: `Scanning ${data.poolName}\t on ${data.chainId}: {bar} {percentage}%\t| {block}/{totalBlocks}\tblocks, {tx}\tdeposits found`,
        etaBuffer: 10000,
      }
    );
    this.bars.set(data.poolName + data.chainId, singleBar);
    return data;
  }

  async update(id: string, data: any, params?: any): Promise<any> {
    if (process.env.NODE_ENV === 'test') {
      return {};
    }
    if (!data.tx) {
      this.bars.get(id).increment(1);
      return {};
    }
    this.bars.get(id).setTotal(this.bars.get(id).getTotal() + data.eventsDelta);
    this.bars.get(id).increment(1, { tx: data.tx });
    if (data.eventsDelta > 0) {
      this.bars.get(id).increment(0, {
        block: data.blockNumber - data.createdAt,
      });
    }
    return {};
  }

  async remove(id: string, params?: any): Promise<any> {
    if (process.env.NODE_ENV === 'test') {
      return {};
    }
    this.bars.get(id).setTotal(1);
    this.bars.get(id).increment(1, {
      block: params.lastQueryBlock - params.createdAt,
    });
    this.bars.get(id).stop();
    //Check if any bars are still not full
    let allFull = true;
    for (const bar of this.bars.values()) {
      if (bar.getTotal() !== bar.getProgress()) {
        allFull = false;
      }
    }
    if (allFull) {
      this.progress.stop();
    }
  }
}
