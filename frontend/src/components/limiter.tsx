import { RateLimiter } from 'limiter';

class Limiter {
  static instance: Limiter;
  limiter: RateLimiter;

  private constructor() {
    // In the case of Alchemy API, it is 330 "compute units" per second
    this.limiter = new RateLimiter({
      tokensPerInterval: 330,
      interval: 'second',
    });
  }

  static getInstance() {
    if (!Limiter.instance) {
      Limiter.instance = new Limiter();
    }
    return Limiter.instance;
  }
}

export default Limiter.getInstance() as Limiter;
