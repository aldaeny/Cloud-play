/** Fence asynchronous viewer results across logout/account changes/unmount.
 * Token refresh for the same user is not an identity change.
 */
export class ViewerIdentity {
  private userId:string|null|undefined;
  private generation=0;
  update(userId:string|null):boolean {
    if(this.userId===userId)return false;
    this.userId=userId;this.generation++;return true;
  }
  invalidate(){this.generation++;}
  capture(){return this.generation;}
  current(generation:number){return generation===this.generation;}
}
