// @flow
import { remote } from 'electron';
import plyr from 'plyr';
import childProcess from 'child_process';
import network from 'network-address';
import vlcCommand from 'vlc-command';
import ChromecastPlayerProvider from './players/ChromecastPlayerProvider';
import type { metadataType } from './players/PlayerProviderInterface';

const { powerSaveBlocker } = remote;

export default class Player {
  currentPlayer = 'plyr';

  powerSaveBlockerId: number;

  /**
   * @private
   */
  player: plyr;

  static nativePlaybackFormats = [
    'mp4',
    'ogg',
    'mov',
    'webmv',
    'mkv',
    'wmv',
    'avi'
  ];

  static experimentalPlaybackFormats = [];

  /**
   * Cleanup all traces of the player UI
   */
  destroy() {
    if (this.powerSaveBlockerId) {
      powerSaveBlocker.stop(this.powerSaveBlockerId);
    }
    if (this.player && this.player.destroy) {
      this.player.destroy();
    }
  }

  /**
   * restart they player's state
   */
  restart() {
    this.player.restart();
  }

  static isFormatSupported(
    filename: string,
    mimeTypes: Array<string>
  ): boolean {
    return !!mimeTypes.find(mimeType =>
      filename.toLowerCase().includes(mimeType)
    );
  }

  async initCast(
    provider: ChromecastPlayerProvider,
    streamingUrl: string,
    metadata: metadataType
  ) {
    this.powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    const addr = streamingUrl.replace('localhost', network());
    return provider.play(addr, metadata);
  }

  initYouTube(itemTitle: string, source: string) {
    console.info('Initializing plyr...');
    this.currentPlayer = 'plyr';

    this.player =
      this.player ||
      plyr.setup({
        volume: 10,
        autoplay: true,
        showPosterOnEnd: true
      })[0];

    const player = this.player;

    player.source({
      title: `${itemTitle} Trailer`,
      type: 'video',
      sources: [
        {
          src: source,
          type: 'youtube'
        }
      ]
    });

    return player;
  }

  initPlyr(streamingUrl: string, metadata: metadataType): plyr {
    console.info('Initializing plyr...');
    this.currentPlayer = 'plyr';
    this.powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');

    this.player =
      this.player ||
      plyr.setup({
        volume: 10,
        autoplay: true,
        showPosterOnEnd: true
      })[0];

    const player = this.player;

    player.source({
      type: 'video',
      sources: [
        {
          src: streamingUrl,
          type: 'video/mp4'
        }
      ]
    });

    if ('full' in metadata.images.poster) {
      player.poster(metadata.images.poster.full);
    }

    player.toggleFullscreen();

    return player;
  }

  initVLC(servingUrl: string) {
    vlcCommand((error, cmd: string) => {
      if (error) return console.error('Could not find vlc command path');

      if (process.platform === 'win32') {
        childProcess.execFile(cmd, [servingUrl], (_error, stdout) => {
          if (_error) return console.error(_error);
          return console.log(stdout);
        });
      } else {
        childProcess.exec(`${cmd} ${servingUrl}`, (_error, stdout) => {
          if (_error) return console.error(_error);
          return console.log(stdout);
        });
      }

      this.powerSaveBlockerId = powerSaveBlocker.start(
        'prevent-app-suspension'
      );

      return true;
    });
  }
}
