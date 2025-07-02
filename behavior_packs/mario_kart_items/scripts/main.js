import * as SERVER from "@minecraft/server";
import * as UI from "@minecraft/server-ui";
import { damage_item, decripateStack, distanceVector, getRandomFloat, getRandomInt, lerp, offsetLocation } from "./utils.js";

console.log("yep its running alright");
SERVER.system.beforeEvents.startup.subscribe((initEvent) => {
  initEvent.itemComponentRegistry.registerCustomComponent("vc:mario_kart_item", {
    onUse: (e, p) => {

      const car = e.source.getComponent('minecraft:riding')?.entityRidingOn //gets the minekart (if present)
      //shroom
      if (p.params.family == "mushroom") {

        const vec = getForwardVector(e.source.getRotation().y);
        e.source.addTag("usedMushroom");
        const stawp = SERVER.system.runInterval(() => { 
          if (car) car.applyKnockback({ x: vec.x * 2, z: vec.z * 2 }, 0);
          else e.source.applyKnockback({ x: vec.x * 2, z: vec.z * 2 }, 0);
         }, 1);
        SERVER.system.runTimeout(() => { SERVER.system.clearRun(stawp); }, 10);

        SERVER.system.runTimeout(() => { e.source.removeTag("usedMushroom"); }, 30); //for shell dodging

        if (e.itemStack.typeId.includes("gold")) e.source.getComponent("equippable").setEquipment("Mainhand", damage_item(e.itemStack));
        else decripateStack(e.source);

        e.source.runCommand(`camerashake add @s 0.5 0.3`);
        e.source.playSound("mk.boost");



        //shell
      } else if (p.params.family == "shell") {
        decripateStack(e.source);
        var type = e.itemStack.typeId == "vc:blue_spiny_shell" ? "vc:blue_shell" : e.itemStack.typeId == "vc:spiny_shell" ? "vc:red_shell" : e.itemStack.typeId == "vc:coin_shell" ? "vc:yellow_shell" : "vc:green_shell";
        const shell = e.source.dimension.spawnEntity(type, e.source.getHeadLocation());
        let movementvec = getForwardVector(e.source.getRotation().y);
        var angle = e.source.getRotation().y;
        let canExplode = false;

        const possibleTargets = e.source.dimension.getEntities().filter((me) => me.nameTag != e.source.nameTag && !me?.getComponent("minecraft:type_family")?.hasTypeFamily("inanimate") && me.typeId != "minecraft:item")
        const target = type == "vc:blue_shell" ? getFarthestEntity(possibleTargets, shell.location) : getNearestEntity(possibleTargets, shell.location);

        const movement = SERVER.system.runInterval(() => {
          if (!shell) return;
          const loc = shell?.location; //general movement
          shell.clearVelocity();
          let vertoffset = 0;

          if (type == "vc:green_shell" || type == "vc:yellow_shell") {
            if (type == "vc:yellow_shell") spawnCoins(shell.location);
            //green
            if (!shell.dimension.getBlock(offsetLocation(loc, { x: movementvec.x, y: 0, z: 0 })).isAir) { movementvec.x = -movementvec.x; shell.dimension.playSound("mk.shell.bounce", shell.location); }
            if (!shell.dimension.getBlock(offsetLocation(loc, { z: movementvec.z, y: 0, x: 0 })).isAir) { movementvec.z = -movementvec.z; shell.dimension.playSound("mk.shell.bounce", shell.location); }
            if (shell.dimension.getBlock(offsetLocation(loc, { z: 0, y: -0.5, x: 0 })).isAir) { vertoffset = -0.5;}
            try { if (distanceVector(shell.location, getNearestEntity(shell.dimension.getEntities().filter((me) => me.nameTag != e.source.nameTag && !me?.getComponent("minecraft:type_family")?.hasTypeFamily("inanimate") && me.typeId != "minecraft:item"), shell.location).location) < 1.5) explode() } catch {}
          }

          shell.teleport( offsetLocation(loc, { x: movementvec.x*0.5, y: target && type != "vc:green_shell" && type != "vc:yellow_shell" ? target.location.y - shell.location.y : vertoffset, z: movementvec.z*0.5}) );

          if (type == "vc:red_shell" || type == "vc:blue_shell") {

            //red
            if (!target) {type = "vc:green_shell"; canExplode = true; return;};

            var targetAngle = canExplode ? getAngleBetweenPoints(shell.location, target?.location) : lerp(angle, getAngleBetweenPoints(shell.location, target?.location), 0.65);
            if (angle > 180 && getAngleBetweenPoints(shell.location, target?.location) < angle && targetAngle < 360) targetAngle += 360;
            angle = targetAngle;
            movementvec = getForwardVector(angle);


            if (shell.dimension.getEntities({ location: shell.location, maxDistance: 1 }).length > 1 && canExplode)
              if (type == "vc:red_shell") explode();
              else blueTime();
          }
          //sounds
            if (e.itemStack.typeId == "vc:spiny_shell") {
              if (SERVER.system.currentTick % 3 == 0) shell.dimension.playSound("mk.red_shell.warn", shell.location);
            }
            if (e.itemStack.typeId == "vc:koopa_shell") {
              if (SERVER.system.currentTick % 3 == 0) shell.dimension.playSound("mk.green_shell.warn", shell.location);
            }
            //blue
            if (e.itemStack.typeId == "vc:blue_spiny_shell") {
              if (SERVER.system.currentTick % 3 == 0) shell.dimension.playSound("mk.blue_shell.warn", shell.location);
            }
        }, 1);
        SERVER.system.runTimeout(() => { SERVER.system.clearRun(movement); shell.remove(); }, 10 * 20); //clears after 10 seconds
        SERVER.system.runTimeout(() => {  canExplode = true; }, 20); //1 second explosion cooldown


        function explode() { //Boom chicka boom
          shell.triggerEvent("boom");
          shell.runCommand(`playsound mk.hit @a ~~~`);
          if (e.itemStack.typeId == "vc:blue_spiny_shell") {
            shell.runCommand(`playsound mk.blue_shell.explode @a ~~~`);
            shell.runCommand(`particle vc:blue_shell_explode ~~~`);
          }
        }
        function blueTime() { //SPINNY BOI
          var tick = 0;
          SERVER.system.clearRun(movement);
          var point = target.location;
          var spinny = SERVER.system.runInterval(() => {
            tick++;
            if (!target.hasTag("usedMushroom")) point = target.location;
            shell.teleport(offsetLocation(point, { x: Math.sin(tick * 0.5) * 2, y: 1.5, z: Math.cos(tick * 0.5) * 2 }));
          }, 1);
          SERVER.system.runTimeout(() => {
            if (!target.hasTag("usedMushroom")) shell.teleport(target.location);
            explode();
          }, 40);
        }



      } else if (p.params.family == "shock") {
        //shock
        for (const crap of e.source.dimension.getEntities({ location: e.source.location, maxDistance: 50 }).filter( (me) =>  me.nameTag != e.source.nameTag && !me?.getComponent("minecraft:type_family")?.hasTypeFamily("inanimate") && me.typeId != "minecraft:item" &&  me.typeId != "minecraft:lightning_bolt"  )) {
          crap.runCommand("summon lightning_bolt");
          SERVER.system.runTimeout(() => {
            decripateStack(e.source)
            crap?.runCommand("fill ~-2~-2~-2 ~2~2~2 air replace fire");
            crap?.runCommand("kill @e[type=lightning_bolt]");
          }, 5);
        }
      } else if (p.params.family == "feather") {
            decripateStack(e.source)
        e.source.playSound('mk.feather')
        
        if (car)  car.applyKnockback({x:0,z:0}, 1);
        else e.source.applyKnockback({x:0,z:0}, 1);

      } else if (p.params.family == "bullet") {
        const entity = e.source.dimension.spawnEntity('vc:bullet', e.source.location)
        entity.setRotation(e.source.getRotation())
        decripateStack(e.source);
        entity.getComponent('minecraft:rideable').addRider(car ? car : e.source)
        e.source.runCommand('camera @s set minecraft:third_person')
        e.source.playSound('mk.bill')
        const movement = SERVER.system.runInterval(()=> {
          if (entity.getComponent('minecraft:rideable').getRiders().length <= 0 || 
          (car && car.getComponent('minecraft:rideable').getRiders().length <= 0)) { 
            SERVER.system.clearRun(movement); 
            entity.remove(); 
            e.source.runCommand('camera @s clear'); 
            e.source.runCommand('stopsound @s mk.bill'); 
            if (car) car.getComponent('minecraft:rideable').addRider(e.source)
            return;
          }
          e.source.addEffect('invisibility', 1, {showParticles: false})
          const movementvec = getForwardVector(e.source.getRotation().y);
          entity.setRotation(e.source.getRotation())
          var vert = (Math.abs(entity.getVelocity().x)+Math.abs(entity.getVelocity().z) < 0.2 ? 0.02 : 0)
          entity.applyImpulse({x:movementvec.x*0.5,y:vert,z:movementvec.z*0.5})
        },1)
        SERVER.system.runTimeout(() => { SERVER.system.clearRun(movement); entity.remove(); e.source.runCommand('camera @s clear') }, 10 * 20); //clears after 10 seconds
      } else if (p.params.family == "bomb") {
        const bomb = e.source.dimension.spawnEntity('vc:bob_om_walk', {
            x: e.source.getHeadLocation().x + e.source.getViewDirection().x,
            y: e.source.getHeadLocation().y + e.source.getViewDirection().y,
            z: e.source.getHeadLocation().z + e.source.getViewDirection().z
        })
        decripateStack(e.source);
        bomb.setRotation(e.source.getRotation())
        bomb.applyImpulse(e.source.getViewDirection())
        bomb.nameTag = e.source.nameTag;
        SERVER.system.runTimeout(()=>{bomb.runCommand('scriptevent vc:bobai')},20)
      } else if (p.params.family == "flower") {
        const type = e.itemStack.typeId == 'vc:fire_flower' ? 'fire' : 'ice'
        e.source.playSound(`mk.${type}_flower`)
        decripateStack(e.source);
        const defrot = e.source.getRotation()
        e.source.setRotation({x:defrot.x,y:defrot.y+20})
        e.source.dimension.spawnEntity('vc:'+type, {
            x: e.source.getHeadLocation().x + e.source.getViewDirection().x,
            y: e.source.getHeadLocation().y + e.source.getViewDirection().y,
            z: e.source.getHeadLocation().z + e.source.getViewDirection().z
        }).getComponent('minecraft:projectile').shoot(e.source.getViewDirection());
        
        e.source.setRotation({x:defrot.x,y:defrot.y-20})
        e.source.dimension.spawnEntity('vc:'+type, {
            x: e.source.getHeadLocation().x + e.source.getViewDirection().x,
            y: e.source.getHeadLocation().y + e.source.getViewDirection().y,
            z: e.source.getHeadLocation().z + e.source.getViewDirection().z
        }).getComponent('minecraft:projectile').shoot(e.source.getViewDirection());
        
        e.source.setRotation(defrot)
        e.source.dimension.spawnEntity('vc:'+type, {
            x: e.source.getHeadLocation().x + e.source.getViewDirection().x,
            y: e.source.getHeadLocation().y + e.source.getViewDirection().y,
            z: e.source.getHeadLocation().z + e.source.getViewDirection().z
        }).getComponent('minecraft:projectile').shoot(e.source.getViewDirection());
      } else if (p.params.family == "boomerang") {
        decripateStack(e.source);
        const rang = e.source.dimension.spawnEntity('vc:boomerang', {
            x: e.source.getHeadLocation().x + e.source.getViewDirection().x*3,
            y: e.source.getHeadLocation().y + e.source.getViewDirection().y*3,
            z: e.source.getHeadLocation().z + e.source.getViewDirection().z*3
        })
        var tick = 0;
        e.source.playSound('mk.boomerang')
        var spinny = SERVER.system.runInterval(() => {
          tick++;
          rang.teleport(offsetLocation(e.source.location, { x: Math.sin(tick * 0.5) * (2+(tick*0.25)), y: 1.5, z: Math.cos(tick * 0.5) * (2+(tick*0.25)) }));
        }, 1);
        SERVER.system.runTimeout(() => {
          rang.remove()
          SERVER.system.clearRun(spinny)
        }, 40);
      } else if (p.params.family == "equip") {
        const type = e.itemStack.typeId
        decripateStack(e.source);
        if (type == 'vc:super_horn') {
          e.source.dimension.playSound('mk.horn',e.source.getHeadLocation())
          const horn = e.source.dimension.spawnEntity('vc:horn', offsetLocation(e.source.getHeadLocation(), {x:0,y:1,z:0}))
          const movement = SERVER.system.runInterval(()=> {
            horn.setRotation(e.source.getRotation())
            horn.teleport(offsetLocation(e.source.getHeadLocation(), {x:0,y:1,z:0}))
            e.source.runCommand('kill @e[family=mario,r=3]')
            e.source.runCommand(`damage @e[r=3,name=!"${e.source.nameTag}"] 2 fireworks`)
          },1)
          SERVER.system.runTimeout(() => { SERVER.system.clearRun(movement); horn.remove(); }, 10 * 3); //clears after 10 seconds
        } else if (type == 'vc:bob_om_cannon') {
          //
          const horn = e.source.dimension.spawnEntity('vc:cannon', offsetLocation(e.source.getHeadLocation(), {x:0,y:0.5,z:0}))
          var tick = 0
          const shiny = (getRandomInt(1,4096) == 1 ? 2 : 20) //sniny pokemon odds, activates minigun mode
          const movement = SERVER.system.runInterval(()=> {
            tick++
            if (tick % shiny == 0) {
              horn.playAnimation('animation.bobom_cannon.shoot')
              const bomb = e.source.dimension.spawnEntity('vc:bob_om_walk', {
                  x: horn.location.x + getForwardVector(e.source.getRotation().y).x,
                  y: horn.location.y + 0.5,
                  z: horn.location.z + getForwardVector(e.source.getRotation().y).z
              })
              e.source.dimension.playSound('mk.hit',e.source.getHeadLocation())
              bomb.setRotation(e.source.getRotation())
              bomb.applyImpulse({
                  x: getForwardVector(e.source.getRotation().y).x*3,
                  y: 0.5,
                  z: getForwardVector(e.source.getRotation().y).z*3
              })
              bomb.nameTag = e.source.nameTag;
              SERVER.system.runTimeout(()=>{bomb.triggerEvent('boom'); bomb.runCommand(`playsound mk.bob_om.explode @a ~~~`); bomb.runCommand(`particle vc:bomb_om_explode ~~~`);},20)
            }
            horn.setRotation(e.source.getRotation())
            horn.teleport(offsetLocation(e.source.getHeadLocation(), {x:0,y:0.5,z:0}))
          },1)
          SERVER.system.runTimeout(() => { SERVER.system.clearRun(movement); horn.remove(); }, 10 * 20); //clears after 10 seconds
        } else if (type == 'vc:banana_barrel') {
          //
          const bananer1 = e.source.dimension.spawnEntity('vc:bbarrel', offsetLocationRot(e.source.getHeadLocation(), {x:1,y:0.5,z:0}, e.source.getRotation().y))
          const bananer2 = e.source.dimension.spawnEntity('vc:bbarrel', offsetLocationRot(e.source.getHeadLocation(), {x:-1,y:0.5,z:0}, e.source.getRotation().y))
          var tick = 0
          const shiny = (getRandomInt(1,4096) == 1 ? 4 : 40) //sniny pokemon odds, activates minigun mode
          const movement = SERVER.system.runInterval(()=> {
            tick++
            if (tick % shiny == 0) {

              bananer1.playAnimation('animation.banana_barrel.shoot')
              e.source.dimension.playSound('mk.hit',e.source.getHeadLocation())

              e.source.dimension.spawnEntity('vc:banana', {
                  x: bananer1.location.x + getForwardVector(e.source.getRotation().y).x,
                  y: bananer1.location.y + 0.5,
                  z: bananer1.location.z + getForwardVector(e.source.getRotation().y).z
              }).getComponent('minecraft:projectile').shoot({
                  x: getForwardVector(e.source.getRotation().y).x,
                  y: 0.5,
                  z: getForwardVector(e.source.getRotation().y).z
              })

              
              SERVER.system.runTimeout(()=>{
              bananer2.playAnimation('animation.banana_barrel.shoot')
              e.source.dimension.playSound('mk.hit',e.source.getHeadLocation())

                e.source.dimension.spawnEntity('vc:banana', {
                  x: bananer2.location.x + getForwardVector(e.source.getRotation().y).x,
                  y: bananer2.location.y + 0.5,
                  z: bananer2.location.z + getForwardVector(e.source.getRotation().y).z
              }).getComponent('minecraft:projectile').shoot({
                  x: getForwardVector(e.source.getRotation().y).x,
                  y: 0.5,
                  z: getForwardVector(e.source.getRotation().y).z
              })
              },shiny/2)
            }

            bananer1.setRotation(e.source.getRotation())
            bananer1.teleport(offsetLocationRot(e.source.getHeadLocation(), {x:1,y:0.5,z:0}, e.source.getRotation().y))
            bananer2.setRotation(e.source.getRotation())
            bananer2.teleport(offsetLocationRot(e.source.getHeadLocation(), {x:-1,y:0.5,z:0}, e.source.getRotation().y))
          },1)
          SERVER.system.runTimeout(() => { SERVER.system.clearRun(movement); bananer1.remove(); bananer2.remove(); }, 10 * 20); //clears after 10 seconds
        } else if (type == 'vc:coin_box') {
          const horn = e.source.dimension.spawnEntity('vc:cbox', offsetLocation(e.source.getHeadLocation(), {x:0,y:1,z:0}))
          const movement = SERVER.system.runInterval(()=> {
            horn.setRotation(e.source.getRotation())
            horn.teleport(offsetLocation(e.source.getHeadLocation(), {x:0,y:1,z:0}))
            spawnCoins(horn.location)
          },1)
          SERVER.system.runTimeout(() => { SERVER.system.clearRun(movement); horn.remove(); }, 10 * 5); //clears after 10 seconds
        }
      } else if (p.params.family == "boo") {
          decripateStack(e.source);
          e.source.dimension.playSound('mk.boo',e.source.getHeadLocation())
          const ogboo = e.source.dimension.spawnEntity('vc:boo_fly', e.source.location)
          ogboo.setRotation({x:0, y:e.source.getRotation().y+180})
          SERVER.system.runTimeout(()=>{ogboo.playAnimation('animation.blooper.use')},2)
          const movement = SERVER.system.runInterval(()=> {
            ogboo.setRotation({x:0, y:e.source.getRotation().y+180})
            ogboo.teleport({
              x: e.source.location.x + getForwardVector(e.source.getRotation().y).x*2,
              y: e.source.location.y,
              z: e.source.location.z + getForwardVector(e.source.getRotation().y).z*2
            })
          },1)
          SERVER.system.runTimeout(() => { 
            SERVER.system.clearRun(movement); ogboo.remove();

            for (const player of SERVER.world.getAllPlayers()) {
              //if (player.nameTag == e.source.nameTag) continue
              player.playSound('mk.boo',player.getHeadLocation())
              const boo = player.dimension.spawnEntity('vc:boo_fly', player.location)
              boo.setRotation({x:0, y:player.getRotation().y+180})
              SERVER.system.runTimeout(()=>{boo.playAnimation('animation.boo.laugh')},2)
              const item = player.getComponent("equippable").getEquipment("Mainhand")
              boo.runCommand('replaceitem entity @s slot.weapon.mainhand 0 '+ (item?.typeId || 'air'))
              player.getComponent("equippable").setEquipment("Mainhand", new SERVER.ItemStack('minecraft:air', 1));
              const movement2 = SERVER.system.runInterval(()=> {
                boo.setRotation({x:0, y:player.getRotation().y+180})
                boo.teleport({
                  x: player.location.x + getForwardVector(player.getRotation().y).x*2,
                  y: player.location.y,
                  z: player.location.z + getForwardVector(player.getRotation().y).z*2
                })
              },1)
              SERVER.system.runTimeout(()=>{
                SERVER.system.clearRun(movement2);  
                if(!item?.typeId.startsWith('vc:')) boo.dimension.spawnItem(item, offsetLocation(boo.location, {x:0,y:1.5,z:0}));
                boo.remove();
              },21)
            }
          }, 21);
      } else if (p.params.family == "blooper") {
          decripateStack(e.source);
          e.source.dimension.playSound('mk.boo',e.source.getHeadLocation(), {pitch:1.5})
          const ogboo = e.source.dimension.spawnEntity('vc:bloop', e.source.location)
          ogboo.setRotation({x:0, y:e.source.getRotation().y+180})
          SERVER.system.runTimeout(()=>{ogboo.playAnimation('animation.blooper.use')},2)
          const movement = SERVER.system.runInterval(()=> {
            ogboo.setRotation({x:0, y:e.source.getRotation().y+180})
            ogboo.teleport({
              x: e.source.location.x + getForwardVector(e.source.getRotation().y).x*2,
              y: e.source.location.y,
              z: e.source.location.z + getForwardVector(e.source.getRotation().y).z*2
            })
          },1)
          SERVER.system.runTimeout(() => { 
            SERVER.system.clearRun(movement); ogboo.remove();

            for (const player of SERVER.world.getAllPlayers()) {
              if (player.nameTag == e.source.nameTag) continue
              player.playSound('mk.boo', {pitch:1.5})
              const boo = player.dimension.spawnEntity('vc:bloop', player.location)
              boo.setRotation({x:0, y:player.getRotation().y+180})
              SERVER.system.runTimeout(()=>{boo.playAnimation('animation.blooper.hi')},2)
              const movement2 = SERVER.system.runInterval(()=> {
                boo.setRotation({x:0, y:player.getRotation().y+180})
                boo.teleport({
                  x: player.location.x + getForwardVector(player.getRotation().y).x*2,
                  y: player.location.y,
                  z: player.location.z + getForwardVector(player.getRotation().y).z*2
                })
              },1)
              SERVER.system.runTimeout(()=>{SERVER.system.clearRun(movement2); boo.remove();player.runCommand('camera @s fade time 0 0.2 3');player.playSound('mk.blooper')},61)
            }
          }, 21);
      } else if (p.params.family == "star") {
          e.source.playSound('mk.star')
          const movement = SERVER.system.runInterval(()=> {
            e.source.addEffect('speed', 1, {amplifier:2,showParticles:false})
            car?.addEffect('speed', 1, {amplifier:2,showParticles:false})
            e.source.addEffect('resistance', 1, {amplifier:255,showParticles:false})
            e.source.spawnParticle('vc:starman', e.source.getHeadLocation())
            e.source.runCommand('kill @e[family=mario,r=1.5]')
            e.source.runCommand(`damage @e[r=1.5,name=!"${e.source.nameTag}"] 5 fireworks`)
          },1)
          SERVER.system.runTimeout(() => { 
            SERVER.system.clearRun(movement);
          },20*15)
      }
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent('vc:slow_kart', {
    onTick: e => {
      e.dimension.getEntitiesAtBlockLocation(e.block.center()).filter(me=>me.typeId == 'vc:minekart').forEach(kart => {
        kart.addEffect('slowness', 2, {showParticles:false,amplifier:3})
      })
    }
  })
});
//all possible items
// ...::3 indicated the item count
const items = [ "vc:koopa_shell", "vc:koopa_shell::3", "vc:banana_peel", "vc:mushroom", "vc:mushroom::3", "vc:banana_barrel", "vc:big_banana_peel", "vc:blooper", "vc:bob_om_cannon", "vc:bob_om", "vc:bob_om::2", "vc:fake_item_box", "vc:boo", "vc:bullet_bill", "vc:coin", "vc:fire_flower", "vc:ice_flower", "vc:boomerang_flower", "vc:super_horn", "vc:spiny_shell", "vc:blue_spiny_shell", "vc:mega_mushroom", "vc:gold_mushroom", "vc:coin_box", "vc:coin_shell", "vc:lightning", "vc:feather", "vc:star",
];
SERVER.system.afterEvents.scriptEventReceive.subscribe((e) => {

  if (e.id == "vc:deactivate_box") { //item box cooldown
    e.sourceEntity.addTag("cooldown");
    e.sourceEntity.addEffect('invisibility',20, {showParticles:false})
    SERVER.system.runTimeout(() => {
      e.sourceEntity.removeTag("cooldown");
    }, 20);
  }

  if (e.id == "vc:item_roulette") { //lets go gambeling
    const container = e.sourceEntity.getComponent("minecraft:inventory").container;
    if (container.emptySlotsCount <= 0) return;
    for (let i = 0; i < container.size; i++) {
      if (!container.getSlot(i).getItem()) {
        e.sourceEntity.playSound("mk.wii.item");
        let roulette = SERVER.system.runInterval(() => {
          const sel = items[getRandomInt(0, items.length - 1)].split("::");
          container.setItem(i, new SERVER.ItemStack(sel[0], sel[1] ?? 1));
        }, 1);
        SERVER.system.runTimeout(() => {
          SERVER.system.clearRun(roulette);
        }, 80);
        return;
      }
    }
  }
  if (e.id == "vc:bobai") {
        let movementvec = getForwardVector(e.sourceEntity.getRotation().y);
        var angle = e.sourceEntity.getRotation().y;
        var gravity = 0


        const movement = SERVER.system.runInterval(() => {
          if (!e.sourceEntity) return;
          const target = getNearestEntity(e.sourceEntity.dimension.getEntities().filter((me) => me.nameTag != e.sourceEntity.nameTag && !me?.getComponent("minecraft:type_family")?.hasTypeFamily("inanimate") && me.typeId != "minecraft:item"), e.sourceEntity.location)
          
          if (!target) {explode(); return;};const loc = e.sourceEntity?.location; //general movement
          e.sourceEntity.clearVelocity();

          gravity = e.sourceEntity.dimension.getBlock(offsetLocation(e.sourceEntity.location, {x:0,y:-0.2,z:0})).isAir ? gravity - 0.2 : 0
          var vert = (Math.abs(e.sourceEntity.getVelocity().x)+Math.abs(e.sourceEntity.getVelocity().z) < 0.1 && gravity <= 0 ? 1 : 0)

          //e.sourceEntity.teleport( offsetLocation(loc, { x: movementvec.x, y: target.location.y - e.sourceEntity.location.y, z: movementvec.z}) );
          e.sourceEntity.applyImpulse({ x: movementvec.x*0.2, y: gravity+vert, z: movementvec.z*0.2})
          if (distanceVector(e.sourceEntity.location, target.location) < 1) explode();

          var targetAngle = getAngleBetweenPoints(e.sourceEntity.location, target?.location);
          if (angle > 180 && getAngleBetweenPoints(e.sourceEntity.location, target?.location) < angle && targetAngle < 360) targetAngle += 360;
          angle = targetAngle;
          e.sourceEntity.setRotation({x:0,y:angle})
          movementvec = getForwardVector(angle);

          }, 2);
        SERVER.system.runTimeout(() => { SERVER.system.clearRun(movement); explode(); }, 10 * 20); //clears after 10 seconds


        function explode() { //Boom chicka boom
          e.sourceEntity.triggerEvent("boom");
          //if (e.itemStack.typeId == "vc:blue_spiny_shell") {
          e.sourceEntity.runCommand(`playsound mk.bob_om.explode @a ~~~`);
          e.sourceEntity.runCommand(`particle vc:bomb_om_explode ~~~`);
          //}
        }
  }
  if (e.id == 'vc:bouncy') {
    if (!e.sourceEntity.dimension.getBlock(offsetLocation(e.sourceEntity.location, {x:0,y:-0.5,z:0})).isAir) {
      const oldvec = e.sourceEntity.getVelocity()
      e.sourceEntity.clearVelocity()
      e.sourceEntity.applyImpulse({
        x: oldvec.x*0.9,
        y: Math.abs(oldvec.y)*0.75,
        z: oldvec.z*0.9
      })
    }
  }
  if (e.id == "vc:cartboom") {
    e.sourceEntity.clearVelocity()
    e.sourceEntity.playAnimation('animation.minekart.blast')
    e.sourceEntity.addEffect('slowness', 20, {amplifier:255,showParticles:false})
  }
  if (e.id == "vc:cartbreak") {
    if (e.sourceEntity.hasTag('areyoureallysure')) {
      e.sourceEntity.dimension.spawnItem(new SERVER.ItemStack('vc:minekart', 1), e.sourceEntity.location)
      e.sourceEntity.triggerEvent('die')

    } else if (e.sourceEntity.hasTag('areyoursure')) {
      e.sourceEntity.addTag('areyoureallysure')
      SERVER.system.runTimeout(()=>{
        e.sourceEntity.removeTag('areyoureallysure')
      },10)
    }
    e.sourceEntity.addTag('areyoursure')
    e.sourceEntity.playAnimation('animation.minekart.blast')
    SERVER.system.runTimeout(()=>{
      e.sourceEntity.removeTag('areyoursure')
    },10)
  }
});
SERVER.world.afterEvents.projectileHitEntity.subscribe(e=>{
  if (e.projectile.typeId == 'vc:ice') {
    e.dimension.playSound('random.glass', e.getEntityHit().entity.location)
    if (!e.getEntityHit().entity || e.getEntityHit().entity?.getComponent("minecraft:type_family")?.hasTypeFamily("inanimate") || e.getEntityHit().entity?.typeId == "minecraft:item") return;
    const entity = e.getEntityHit().entity.dimension.spawnEntity(`vc:ice_jail`, e.getEntityHit().entity.location)
    const motion = e.getEntityHit().entity.getVelocity()
    e.getEntityHit().entity.extinguishFire()
    entity.setRotation(e.getEntityHit().entity.getRotation())
    entity.getComponent('minecraft:rideable').addRider(e.getEntityHit().entity)
    var no = SERVER.system.runInterval(()=>{
      entity.applyImpulse(motion)
      if (entity.getComponent('minecraft:rideable').getRiders().length <= 0) entity.getComponent('minecraft:rideable').addRider(e.getEntityHit().entity) //you cant escape
      entity.setRotation({x:entity.getRotation().x,y:entity.getRotation().y+5})
    },2)
    SERVER.system.runTimeout(()=>{SERVER.system.clearRun(no), e.dimension.playSound('random.glass', e.getEntityHit().entity.location)},60)
  } else if (e.projectile.typeId == 'vc:fire') {
    if (e.getEntityHit().entity.getComponent("minecraft:type_family")?.hasTypeFamily("inanimate") || e.getEntityHit().entity.typeId == "minecraft:item") return;
    e.getEntityHit().entity.setOnFire(5, true)
  }
})
SERVER.world.afterEvents.playerInteractWithEntity.subscribe(e=>{
  //console.warn('replaceitem entity @s slot.weapon.mainhand 0 banner 1 ' + superStackGetData(e.player))
  if (e.itemStack?.typeId == 'minecraft:banner' && e.player.isSneaking) {
    //e.player.runCommand('give @s minecraft:banner 1 ' + superStackGetData(e.target, 'minecraft:banner'))
    //e.target.dimension.playSound('armor.equip_leather', e.target.location)
    //e.target.runCommand('replaceitem entity @s slot.weapon.mainhand 0 banner 1 ' + superStackGetData(e.player, 'minecraft:banner'))
    //decripateStack(e.player)
  } else if (!e.player.isSneaking) {
    e.target.getComponent('minecraft:rideable').addRider(e.player)
  }

    //look at all these failed attempts lmao
  
  //console.log(e.target.getComponent('minecraft:equippable').getEquipment("Mainhand").typeId)
  //console.log(JSON.stringify(e.itemStack.getComponent('minecraft:dyeable')?.color))
  //for (let i = 0; i < e.target.getComponent('minecraft:inventory').container.size; i++) {
  //  console.log(e.target.getComponent('minecraft:inventory').container.setItem(i,e.itemStack))
  //}
})
/**
 * Get item data function modified from the SuperStack library
 * gets the data of the item the player is holding
 * @param {SERVER.PLayer} player the player
 * @returns {Number} the data value
 */
function superStackGetData(player, typeId) {
  let data = 0
  for (data; data < 100; data++) {
      const success = player.runCommand(`testfor @s[hasitem={item=${typeId},data=${data},slot=0,location=slot.weapon.mainhand}]`).successCount
      if (success >= 1) break;
  }
  return data
}
/**
 *
 * @param {SERVER.Vector3} loc Area to spawn coins
 */
function spawnCoins(loc) {
  SERVER.world.getDimension("overworld").playSound("mk.coin", loc, { volume: 0.2 });
  SERVER.world
    .getDimension("overworld")
    .spawnItem(
      new SERVER.ItemStack(getRandomInt(0, 3) == 0 ? "vc:event_coin" : "vc:coin", getRandomInt(1, 2)),
      offsetLocation(loc, { x: getRandomFloat(-0.5, 0.5), y: getRandomFloat(-0.5, 0.5), z: getRandomFloat(-0.5, 0.5) })
    );
}
/**
 * 
 * @param {Array<SERVER.Entity>} entities List of entites
 * @param {SERVER.Vector3} location the location
 * @returns {SERVER.Entity} the closest entity in the list to the location
 */
function getNearestEntity(entities, location) {
  let winner = entities[0]
  for (const entity of entities) {
    if (distanceVector(entity.location, location) < distanceVector(winner.location, location)) winner = entity
  }
  return winner
}
/**
 * 
 * @param {Array<SERVER.Entity>} entities List of entites
 * @param {SERVER.Vector3} location the location
 * @returns {SERVER.Entity} the farthest entity in the list to the location
 */
function getFarthestEntity(entities, location) {
  let winner = entities[0]
  for (const entity of entities) {
    if (distanceVector(entity.location, location) > distanceVector(winner.location, location)) winner = entity
  }
  return winner
}
/**
 * Returns the x and z to move forward to move a total of 1 block in `degrees` rotation
 * @param {Float} degrees angle in degrees you want to move foreward
 * @returns {SERVER.VectorXZ}
 */
function getForwardVector(degrees) {
  const radians = degrees * (Math.PI / 180);
  const x = -Math.sin(radians);
  const z = Math.cos(radians);
  return { x, z };
}
/**
 * 
 * @param {SERVER.Vector3} location the origin
 * @param {SERVER.Vector3} offset in blocks, what to offset by
 * @param {Number} rotationDegrees rotation to rotate the offset by
 * @returns {SERVER.Vector3}
 */
export function offsetLocationRot(location, offset, rotationDegrees = 0) {
    const forward = getForwardVector(-rotationDegrees); //idk why it has to be negative, it just is
    const rotatedOffset = {
        x: forward.x * offset.z + forward.z * offset.x,
        y: offset.y, // Y remains unchanged for horizontal rotation   //🤓☝️
        z: -forward.z * offset.z + forward.x * offset.x
    };
    return {
        x: location.x + rotatedOffset.x,
        y: location.y + rotatedOffset.y,
        z: location.z + rotatedOffset.z
    };
}
/**
 *
 * @param {SERVER.Vector3} a
 * @param {SERVER.Vector3} b
 * @returns {Number} Angle from point `a` to point `b`
 */
function getAngleBetweenPoints(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;

  // atan2 returns radians relative to +X, so swap and invert axes to match +Z forward
  let radians = Math.atan2(-dx, dz);
  let degrees = radians * (180 / Math.PI);

  if (degrees < 0) degrees += 360; // Normalize to [0, 360)

  return degrees;
}

let previousYaw = 0;

/**
 *
 * @param {*} currentYaw Current degrees of rotation the cart is at
 * @param {*} deltaTime current tick
 * @returns {Number} Angle the cart is turning
 */
function updateTurnSharpness(currentYaw, deltaTime) {
  let deltaYaw = currentYaw - previousYaw;

  // Wrap around 360°
  if (deltaYaw > 180) deltaYaw -= 360;
  if (deltaYaw < -180) deltaYaw += 360;

  const angularVelocity = deltaYaw / deltaTime; // degrees per second
  previousYaw = currentYaw;

  return Math.abs(angularVelocity); // Sharpness as absolute turn speed
}
/**
 *
 * @param {SERVER.Vector3} original the origin
 * @param {*} time lifetime
 * @param {*} spinSpeed optional speed to spin
 * @param {*} expansionRate option speed to leave origin
 * @returns {SERVER.Vector3} new position after spinning
 */
function spiralPosition(original, time, spinSpeed = 1, expansionRate = 0.01) {
  // Calculate distance from origin expanding over time
  const distance = Math.sqrt(original.x ** 2 + original.z ** 2) + time * expansionRate;

  // Get current angle around origin, add spin based on time
  const baseAngle = Math.atan2(original.z, original.x);
  const angle = baseAngle + time * spinSpeed;

  // New XZ position on spiral
  const x = Math.cos(angle) * distance;
  const z = Math.sin(angle) * distance;

  return { x, y: original.y, z };
}
