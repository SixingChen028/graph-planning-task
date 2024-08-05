const BLOCK_SIZE = 100;

let ensureSign = x => x > 0 ? "+" + x : "" + x

const FAST_MODE = (new URLSearchParams(location.search)).get('fast') == '1'


class Graph {
  constructor(adjacency) {
    // adjacency is a list of [state, children] pairs
    // Graph([[0, [1, 2]], [1, [3, 4]], [2, [5, 6]], ...]) // an example of a binary tree.

    this._adjacency = {}
    this.states = [];
    adjacency.forEach((successors, state) => {
      this.states.push(state);
      this._adjacency[state] = [...successors] // copy
    })
    this.states.sort();
  }

  successors(state) {
    return this._adjacency[state];
  }

  predecessors(state) {
    return this.states.filter(s => _.contains(this.successors(s), state))
  }

  shuffleSuccessors() {
    /*
    Modifies the graph, shuffling successors.
    */
    for (const state of this.states) {
      this._adjacency[state] = jsPsych.randomization.repeat(this._adjacency[state], 1);
    }
  }
}

// original version
function circleXY(N) {
  return _.range(N).map(idx => {
    const angle = 3 * Math.PI / 2 + (idx * 2 * Math.PI / N);
    let x = (Math.cos(angle) + 1) / 2;
    let y = (Math.sin(angle) + 1) / 2;
    return [x, y];
  });
}


function treeXY(start, graph) {
  let xy = Array(graph.states.length).fill([])

  function recurse(s, x, depth) {
    console.log('recurse', s, x, depth)
    let y = depth * .2
    xy[s] = [x, y]

    let spread = 2.1 ** (4 - depth) / 70
    let xs = [x - spread, x + spread]
    graph.successors(s).forEach((s1, i) => {
      recurse(s1, xs[i], depth + 1)
    })
  }
  recurse(start, 0.5, 0)
  return xy
}


class CircleGraph {
  constructor(options) {
    this.options = options = _.defaults(options, {
      consume: true,
      edgeShow: (() => true),
      show_steps: options.n_steps > 0,
      show_points: true,
      show_successor_rewards: false,
      keep_hover: true,
      revealed: false,
    })
    // successorKeys:  options.graphRenderOptions.successorKeys
    this.trialId = randomUUID()
    this.logEvent('graph.construct', _.pick(this.options,
      'graph', 'n_steps', 'rewards', 'start', 'hover_edges', 'hover_rewards', 'expansions'
    ))
    this.root = $("<div>")
    .css({
      position: 'relative',
      textAlign: 'center',
    })

    window.cg = this

    this.rewards = [...options.rewards] ?? Array(options.graph.length).fill(0)
    this.onStateVisit = options.onStateVisit ?? ((s) => {})
    this.score = options.score ?? 0

    if (options.consume) {
      this.rewards[options.start] = 0
    }

    // options.rewardGraphics[0] = options.rewardGraphics[0] ?? ""
    // options.graphics = this.rewards.map(x => options.rewardGraphics[x])

    this.graph = new Graph(options.graph)

    // SIXING: you'll want to remove this line
    // options.graphRenderOptions.fixedXY = treeXY(options.start, this.graph)


    this.el = renderCircleGraph(
      this.graph, options.goal,
      {
        edgeShow: options.edgeShow,
        successorKeys: options.successorKeys,
        ...options.graphRenderOptions,
      }
    )
    $(this.el)
    // .css('border', 'thick black solid')  // useful for debugging
    .hide()

    this.graphContainer = $("<div>")
    .css({
      margin: 'auto',
      width: options.graphRenderOptions.width,
      height: options.graphRenderOptions.height,
      // transform: `scale(${scale})`
    })
    .appendTo(this.root)
    .append(this.el)


    this.setRewards(options.rewards)
  }

  attach(div) {
    div.empty()
    this.root.appendTo(div)
    return this
  }

  async run(display) { // main function of a trial
    if (display) this.attach(display)

    this.setCurrentState(this.options.start)
    await this.showStartScreen()
    if (!this.options.revealed) {
      await this.plan() // planning phase
    }
    await this.navigate() // main trial phase
  }

  logEvent(event, info={}) {
    info.trialId = this.trialId
    logEvent(event, info)
    if (this.logger_callback) this.logger_callback(event, info)
  }

  highlight(state, postfix='') {
    this.logEvent('graph.highlight', {state})
    $(`.GraphNavigation-State-${state}`).addClass(`GraphNavigation-State-Highlighted${postfix}`)
  }
  unhighlight(state, postfix='') {
    this.logEvent('graph.unhighlight', {state})
    $(`.GraphNavigation-State-${state}`).removeClass(`GraphNavigation-State-Highlighted${postfix}`)
  }

  async showGraph() {
    this.logEvent('graph.showGraph')
    // this.setupEyeTracking()

    if (!this.options.revealed && this.options.hover_rewards) this.el.classList.add('hideStates');
    if (!this.options.revealed && this.options.hover_edges) this.el.classList.add('hideEdges');
    $(`.ShadowState .GraphReward`).remove()
    if (!this.options.show_steps) {
      $("#gn-steps").hide()
    }
    if (!this.options.show_points) {
      $("#gn-points").hide()
    }

    $(this.el).show()
  }

  async removeGraph() {
    $(this.el).animate({opacity: 0}, 300);
    await sleep(300)
    this.el.innerHTML = ""
    $(this.el).css({opacity: 1});
  }

  async showStartScreen() {
    if (FAST_MODE) {
      this.showGraph()
      return
    }
    this.logEvent('graph.showStartScreen')
    if (this.options.actions) {
      $('<div>')
      .addClass('pressspace')
      .css({
        'text-align': 'left',
        'font-size': 20,
        'margin-top': 100,
        'margin-bottom': -125,
      })
      .html(markdown(`
        ## Participant Playback

        - step through actions with space
        - the next hovered state is highlighted in yellow (green for initial state)
        - you can change which participant and trial you are viewing with url parameters, e.g.
          \`?demo=v15/P02&trial=3\`
        - press enter to begin
      `))
      .appendTo(this.root)
      await getKeyPress(['enter'])
      $('.pressspace').remove()
      this.showGraph()
      return
    }

    this.graphContainer.css({border: 'thin white solid'}) // WTF why does this fix positioning??
    let msg = $('<p>')

    if (this.options.start_message) {
      msg
      .css({marginTop: 120})
      .appendTo(this.graphContainer)
      .text(this.options.start_message)
    }

    await button(this.root, 'start', {
      post_delay: 0,
      persistent: false,
        cls: 'absolute-centered',
    }).promise()
    // .css({marginTop: '210px'})

    msg.remove()

    await sleep(200)
    // if (this.options.n_steps > 0) {
    //   let moves = $('<p>')
    //   .text(numString(this.options.n_steps, "move"))
    //   .addClass('Graph-moves')
    //   .appendTo(this.root)
    //   await sleep(1000)
    //   moves.remove()
    // }
    this.showGraph()
  }

  setupEyeTracking() {
    this.data.state_boxes = {}
    this.graph.states.forEach(s => {
      this.data.state_boxes[s] = this.el.querySelector(`.GraphNavigation-State-${s}`).getBoundingClientRect()
    })
    this.data.gaze_cloud = []
    GazeCloudAPI.OnResult = d => {
      this.data.gaze_cloud.push(d)
    }
  }

  async plan(intro=false) {
    this.logEvent('graph.imagination.start')
    if (this.options.actions) return  // demo mode
    // don't double up the event listeners
    if (this.planningPhaseActive) return
    this.planningPhaseActive = true

    $('.GraphNavigation').css('opacity', 1.)


    let transition = '300ms'
    let eventType = 'mouseenter'
    if (this.options.reveal_by == 'click') {
      transition = '500ms'
      eventType = 'click'
    }
    $('.GraphNavigation-arrow,.GraphReward,.GraphNavigation-edge').css('transition', `opacity ${transition}`)

    for (const el of this.el.querySelectorAll('.State:not(.ShadowState)')) {
      const state = parseInt(el.getAttribute('data-state'), 10);
      el.classList.add('PathIdentification-selectable')
      el.addEventListener(eventType, (e) => {
        if (this.planningPhaseActive) {
          this.logEvent('graph.imagine', {state})
          this.hover(state)
        }
      });
    }

    if (!intro) {
      await this.enableExitImagination()
    }

    // this.unhoverAll()
    // await sleep(100)
  }

  async enableExitImagination() {

    let stateDiv = $(`.GraphNavigation-State-${this.state}`)
    let ready = makePromise()

    let label = $('<span>').appendTo(stateDiv)
    .css({
      fontSize: 14,
      color: 'white',
      transition: 'opacity 100ms',
      opacity: 0,
    })
    .addClass('absolute-centered')
    .html('ready?')

    stateDiv.on('mouseenter', () => label.css('opacity', 1))
    .on('mouseleave', () => label.css('opacity', 0))
    .on('click', async () => {
      ready.resolve()
      label.css('opacity', 0)
      await sleep(100)
      label.remove()
    })
    await ready
    this.logEvent('graph.imagination.end')
    this.planningPhaseActive = false
    $('.GraphNavigation').css('opacity', 1)
    $(`.GraphNavigation-State`).removeClass('PathIdentification-selectable')
    $('.GraphNavigation-arrow,.GraphReward,.GraphNavigation-edge').css('transition', '')
  }

  setCurrentState(state, options) {
    this.state = state;
    setCurrentState(this.el, this.graph, this.state, {
      edgeShow: this.options.edgeShow,
      successorKeys: this.options.successorKeys,
      onlyShowCurrentEdges: this.options.graphRenderOptions.onlyShowCurrentEdges,
      ...options,
    });
    this.hover(state)
  }

  clickTransition(options) {
    options = options || {};
    /*
    Returns a promise that is resolved with {state} when there is a click
    corresponding to a valid state transition.
    */
    const invalidStates = new Set(options.invalidStates || [this.state, this.options.goal]);

    for (const s of this.graph.states) {
      const el = this.el.querySelector(`.GraphNavigation-State-${s}`);
      if (invalidStates.has(s)) {
        el.classList.remove('PathIdentification-selectable');
      } else {
        el.classList.add('PathIdentification-selectable');
      }
    }

    return new Promise((resolve, reject) => {
      const handler = (e) => {
        const el = $(e.target).closest('.PathIdentification-selectable').get(0);
        if (!el) {
          return;
        }
        e.preventDefault();
        const state = parseInt(el.getAttribute('data-state'), 10);

        this.el.removeEventListener('click', handler);
        resolve({state});
      }

      this.el.addEventListener('click', handler);
    });
  }

  addPoints(points, state) {
    logEvent('graph.addPoints', {points})
    if (points == 0) {
      return
    }
    this.setScore(this.score + points)
  }

  setScore(score) {
    this.score = score;
    $("#GraphNavigation-points").html(this.score)
  }

  hideAllEdges() {
    $(`.GraphNavigation-edge`).removeClass('is-visible');
    $(`.GraphNavigation-arrow`).removeClass('is-visible');
  }

  showOutgoingEdges(state) {
    this.hideAllEdges()
    for (const successor of this.graph.successors(state)) {
      this.showEdge(state, successor)
    }
  }

  async visitState(state, initial=false) {
    assert(typeof(1) == 'number')
    this.logEvent('graph.visit', {state, initial})
    this.onStateVisit(state);

    this.setCurrentState(state);


    this.showRewardSymbol(state); // show reward symbols


    if (!initial) {
      this.addPoints(this.rewards[state], state)
      if (this.options.consume) {
        this.rewards[state] = 0
        // let cls = (points < 0) ? "loss" : "win"
        // let sign = (points < 0) ? "" : "+"
        await sleep(200)
        $(`.GraphNavigation-State-${state} > .GraphReward`).addClass('floatup')
        // $(`.GraphNavigation-State-${state} > .GraphReward`).remove() // controls the floatup of the colors
      }
    }
  }

  async navigate(options) { // main function
    let path = []
    this.logEvent('graph.navigate', options)
    options = options || {};
    if (this.state === undefined) {
      this.setCurrentState(this.options.start)
    }
    let goal = options.goal ?? this.options.goal
    const termination = options.termination || ((cg, state) => {
      return (this.graph.successors(state).length == 0) || state == goal
    });
    let stepsLeft = options.n_steps ?? this.options.n_steps;

    $("#GraphNavigation-steps").html(stepsLeft)
    this.visitState(this.state, true)

    if (this.options.actions) {
      await this.showDemo()
      return
    }

    if (this.options.forced_hovers) {
      await this.showForcedHovers()
      this.showOutgoingEdges(this.state)
    }

    while (true) { // eslint-disable-line no-constant-condition
      // State transition
      const g = this.graph;
      const {state} = await this.clickTransition({
        invalidStates: new Set(
          g.states.filter(s => !g.successors(this.state).includes(s))
        ),
      });
      if (this.options.forced_hovers) {
        this.hideAllEdges()
        this.showEdge(this.state, state)
        this.showState(state)
      }
      this.visitState(state)
      if (this.options.forced_hovers) {
        await sleep(500)
        this.showOutgoingEdges(state)
      }


      // execute rollout here
      await this.executeRollout()



      path.push(state)

      stepsLeft -= 1;
      $("#GraphNavigation-steps").html(stepsLeft)
      if (termination(this, state) || stepsLeft == 0) {
        this.logEvent('graph.done')
        await sleep(500)
        $(".GraphNavigation-currentEdge").removeClass('GraphNavigation-currentEdge')
        if (options.leave_state) {
          // $(`.GraphNavigation-State-${state}`).animate({opacity: .1}, 500)
        } else if (options.leave_open) {
          $(`.GraphNavigation-State-${state}`).animate({opacity: 0}, 500)  // works because shadow state
          $('.State .GraphReward').animate({opacity: 0}, 500)
          await sleep(1000)
          // $(this.el).animate({opacity: 0}, 500); await sleep(500)
          // $(this.el).empty()
        } else {
          await sleep(200)
          $(this.el).animate({opacity: 0}, 200)
          await sleep(500)
        }
        // $(this.el).addClass('.GraphNavigation-terminated')


        $(`.GraphNavigation-current`).removeClass('GraphNavigation-current');
        // this.setCurrentState(undefined)
        break;
      }
      await sleep(200);
      // await sleep(5)
    }
    return path
  }

  async showDemo() {
    // if (this.options.actions.length == 0) return

    let a0 = this.options.actions[0]
    if (a0?.type == "fixate") this.highlight(a0.state, '2')
    await getKeyPress(['t', 'space'])
    if (a0?.type == "fixate") this.unhighlight(a0.state, '2')

    for (var i = 0; i < this.options.actions.length; i++) {
      let a = this.options.actions[i]
      let a2 = this.options.actions[i+1]
      // this.highlight(a.state, '3')
      if (a2?.type == "fixate") this.highlight(a2.state, '2')
      if (a.type == "move") {
        this.hover(a.state)
        this.visitState(a.state)
      } else {
        this.hover(a.state)
      }
      await getKeyPress(['t', 'space'])
      // this.unhighlight(a.state, '3')
      this.unhighlight(a2?.state, '2')
    }
  }

  async executeRollout() {
    let rolloutPath = [this.state]; // Store the rollout path

    while (true) {
      let children = this.graph.successors(this.state);
      if (children.length === 0) {
        break;
      } else {
        let child = _.sample(children);
        rolloutPath.push(child); // Add the child to the rollout path

        this.state = child; // Update the current state to the child state
      }
    }

    // Sequentially light up the states in the rollout path
    for (const state of rolloutPath) {
      this.visitState(state);
      await sleep(800);
    }
  }

  // Function to dynamically show reward symbols
  async showRewardSymbol(state) {
    let reward = this.rewards[state];

    const minValue = -8;
    const maxValue = 8;

    $(this.el.querySelector(`.GraphNavigation-State-${state}`))
    .append(
      $(`<div>`)
        .css({
          position: 'absolute',
          top: '-45px', // Move up by 50 pixels
          left: '45px', // Move right by 30 pixels
          transform: 'none', // Cancel any transformation to use the offset directly
          fontSize: '5rem', // Adjust the font size as needed
          color: getColorForValue(reward, minValue, maxValue),
        })
        .html(`${reward == 0 ? '' : ensureSign(reward)}`)
        .addClass(reward < 0 ? "loss" : "win")
    )
  }

  async showForcedHovers(start=0, stop) {
    $(this.el).addClass('forced-hovers')
    this.logEvent('graph.forced.start')
    let delay = 1000
    // await sleep(delay)
    this.hover(this.options.expansions[0][0])
    for (var i = start; i < (stop ?? this.options.expansions.length); i++) {
      let [s1, s2] = this.options.expansions[i]
      // this.showEdge(s1, s2)
      await sleep(delay)
      this.highlight(s2)
      await this.hoverStatePromise(s2)
      this.unhighlight(s2)
      // await getKeyPress()

      // this.hideEdge(s1, s2)
      this.logEvent('graph.forced.hover', {s1, s2, duration: delay})
      this.hover(s2)
      // this.showState(s2)
      // await sleep(delay)

      // this.hideState(s2)
    };
    await sleep(delay)
    $(this.el).removeClass('forced-hovers')
    this.logEvent('graph.forced.end')
  }

  clickStatePromise(state) {
    return new Promise((resolve, reject) => {
      $(`.GraphNavigation-State-${state}`).css('cursor', 'pointer')
      $(`.GraphNavigation-State-${state}`).one('click', () => {
        $(`.GraphNavigation-State-${state}`).css('cursor', '')
        resolve()
      })
    })
  }

  hoverStatePromise(state) {
    return new Promise((resolve, reject) => {
      $(`.GraphNavigation-State-${state}`).one('mouseover', () => {
        resolve()
      })
    })
  }

  highlightEdge(s1, s2) {
    $(this.el).addClass('SomeHighlighted')
    $(`.GraphNavigation-edge,.GraphNavigation-arrow`).removeClass('HighlightedEdge')
    $(`.GraphNavigation-edge-${s1}-${s2}`).addClass('HighlightedEdge')
  }

  showState(state) {
    $(`.GraphNavigation-State-${state}`).addClass('is-visible')
  }

  hideState(state) {
    this.logEvent('graph.hide_state', {state})
    $(`.GraphNavigation-State-${state}`).removeClass('is-visible')
  }

  showEdge(state, successor) {
    $(`.GraphNavigation-edge-${state}-${successor}`).addClass('is-visible')
  }

  hideEdge(state, successor) {
    $(`.GraphNavigation-edge-${state}-${successor}`).removeClass('is-visible')
  }

  unhoverAll() {
    $(`.GraphNavigation-State`).removeClass('is-visible')
    $(`.GraphNavigation-State`).removeClass('hovered')
    this.hideAllEdges()
  }

  async hover(state) {
    // if (!(this.options.hover_edges || this.options.hover_rewards)) return
    // this.logEvent('hover', {state})
    // if (this.options.forced_hovers) return
    if (this.options.keep_hover) {
      this.unhoverAll()
    }
    if (this.options.show_hovered_reward) this.showState(state)
    $(`.GraphNavigation-State-${state}`).addClass('hovered')
    for (const successor of this.graph.successors(state)) {
      this.showEdge(state, successor)
      if (this.options.show_successor_rewards) this.showState(successor)
    }
    if (this.options.show_predecessors) {
      for (const pred of this.graph.predecessors(state)) {
        this.showEdge(pred, state)
      }
    }
  }

  unhover(state) {
    if (this.options.forced_hovers) return
    if (this.options.keep_hover) return
    $(`.GraphNavigation-State-${state}`).removeClass('hovered')

    if (this.options.show_hovered_reward) this.hideState(state)
    for (const successor of this.graph.successors(state)) {
      this.hideEdge(state, successor)
      if (this.options.show_successor_rewards) this.hideState(successor)
    }
    if (this.options.show_predecessors) {
      for (const pred of this.graph.predecessors(state)) {
        this.hideEdge(pred, state)
      }
    }
  }

  loadTrial(trial) {
    if (trial.start != undefined) this.setCurrentState(trial.start)
    this.setRewards(trial.rewards)
    this.options.n_steps = trial.n_steps ?? this.options.n_steps
  }

  setReward(state, reward) {
    this.rewards[state] = parseFloat(reward)
    // let graphic = this.options.rewardGraphics[reward]

    // original version of reward symbols
    // we have to use the default querySelector because this.el hasn't
    // been added to the DOM yet
    // $(this.el.querySelector(`.GraphNavigation-State-${state}`)).html(
    //   $('<div>', {'class': 'GraphReward'}).html(`
    //     ${reward == 0 ? '' : ensureSign(reward)}
    //   `).addClass(reward < 0 ? "loss" : "win")
    // )


    // green-red version of reward colors
    // function interpolateColor(color1, color2, factor) {
    //   if (arguments.length < 3) { factor = 0.5; }
    //   var result = color1.slice();
    //   for (var i = 0; i < 3; i++) {
    //       result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
    //   }
    //   return result;
    // }
    
    
    // function getColorForValue(value, minValue, maxValue) {
    //   if (value === 0) return 'transparent';

    //   var minColor, maxColor;
  
    //   if (value > 0) {
    //     minColor = [255, 255, 0]; // Yellow
    //     maxColor = [0, 255, 0];   // Green
    //   } else {
    //     minColor = [255, 255, 0]; // Yellow
    //     maxColor = [255, 0, 0];   // Red
    //   }
  
    //   var factor = Math.abs(value) / maxValue;
    //   return 'rgb(' + interpolateColor(minColor, maxColor, factor).join(',') + ')';
    // }

    const minValue = -8;
    const maxValue = 8;

    $(this.el.querySelector(`.GraphNavigation-State-${state}`)).html(
      $('<div>', {'class': 'GraphReward'}).css({
        width: '6.6rem',
        height: '6.6rem',
        borderRadius: '100%',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: getColorForValue(reward, minValue, maxValue),
      })
      // .append(
      //   $(`<div>`)
      //       .css({
      //           position: 'absolute',
      //           top: '-50px', // Move up by 50 pixels
      //           left: '50px', // Move right by 30 pixels
      //           transform: 'none', // Cancel any transformation to use the offset directly
      //           fontSize: '5rem', // Adjust the font size as needed
      //           color: getColorForValue(reward, minValue, maxValue),
      //       })
      //       .html(`${reward == 0 ? '' : ensureSign(reward)}`)
      //       .addClass(reward < 0 ? "loss" : "win")
      // )

    );
    
  }

  setRewards(rewards) {
    for (let s of _.range(this.rewards.length)) {
      this.setReward(s, s == this.state ? 0 : rewards[s])
    }
  }
}





// viridis version of reward colors
// Key Viridis colors
const viridisKeyColors = [
  // [68, 1, 84],   // Dark purple
  [59, 82, 139], // Blue
  [33, 145, 140],// Greenish-blue
  [94, 201, 98], // Green
  [253, 231, 37] // Yellow
];

// Linear interpolation between two colors
function lerpColor(color1, color2, factor) {
  return color1.map((c, i) => Math.round(c + factor * (color2[i] - c)));
}

// Function to get interpolated Viridis color
function getColorForValue(value, minValue, maxValue) {
  if (value === 0) return 'transparent';

  const normalizedValue = (value - minValue) / (maxValue - minValue);
  const numSegments = viridisKeyColors.length - 1;
  const segment = Math.min(numSegments - 1, Math.floor(normalizedValue * numSegments));
  const localFactor = (normalizedValue * numSegments) - segment;

  const color1 = viridisKeyColors[segment];
  const color2 = viridisKeyColors[segment + 1];

  return `rgb(${lerpColor(color1, color2, localFactor).join(', ')})`;
}





const stateTemplate = (state, options) => {
  let cls = `GraphNavigation-State-${state}`;
  if (options.goal) {
    cls += ' GraphNavigation-goal';
  }
  return `
  <div class="State GraphNavigation-State ${cls || ''}" style="${options.style || ''}" data-state="${state}">
  </div>
  `;
    // <img src="${graphicsUrl(graphic)}" dragggable=false/>
};

const renderSmallEmoji = (graphic, cls) => `
<img style="height:40px" src="${graphicsUrl(graphic)}" />
`;

function keyForCSSClass(key) {
  // Using charcode here, for unrenderable keys like arrows.
  return key.charCodeAt(0);
}

function graphXY(graph, width, height, scaleEdgeFactor, fixedXY) {
  /*
  This function computes the pixel placement of nodes and edges, given the parameters.
  */
  assert(0 <= scaleEdgeFactor && scaleEdgeFactor <= 1);

  // We make sure to bound our positioning to make sure that our blocks are never cropped.
  const widthNoMargin = width - BLOCK_SIZE;
  const heightNoMargin = height - BLOCK_SIZE;

  // We compute bounds for each dimension.
  const maxX = Math.max.apply(null, fixedXY.map(xy => xy[0]));
  const minX = Math.min.apply(null, fixedXY.map(xy => xy[0]));
  const rangeX = maxX-minX;
  const maxY = Math.max.apply(null, fixedXY.map(xy => xy[1]));
  const minY = Math.min.apply(null, fixedXY.map(xy => xy[1]));
  const rangeY = maxY-minY;

  // We determine the appropriate scaling factor for the dimensions by comparing the
  // aspect ratio of the bounding box of the embedding with the aspect ratio of our
  // rendering viewport.
  let scale;
  if (rangeX/rangeY > widthNoMargin/heightNoMargin) {
    scale = widthNoMargin / rangeX;
  } else {
    scale = heightNoMargin / rangeY;
  }

  // We can now compute an appropriate margin for each dimension that will center our graph.
  let marginX = (width - rangeX * scale) / 2;
  let marginY = (height - rangeY * scale) / 2;

  // Now we compute our coordinates.
  const coordinate = {};
  const scaled = {};
  for (const state of graph.states) {
    let [x, y] = fixedXY[state];
    // We subtract the min, rescale, and offset appropriately.
    x = (x-minX) * scale + marginX;
    y = (y-minY) * scale + marginY;
    coordinate[state] = [x, y];
    // We rescale for edges/keys by centering over the origin, scaling, then translating to the original position.
    scaled[state] = [
      (x - width/2) * scaleEdgeFactor + width/2,
      (y - height/2) * scaleEdgeFactor + height/2,
    ];
  }

  return {
    coordinate,
    scaled,
    edge(state, successor) {
      return normrot(scaled[state], scaled[successor]);
    },
  };
}

function normrot([x, y], [sx, sy]) {
  // This function returns the length/norm and angle of rotation
  // needed for a line starting at [x, y] to end at [sx, sy].
  const norm = Math.sqrt(Math.pow(x-sx, 2) + Math.pow(y-sy, 2));
  const rot = Math.atan2(sy-y, sx-x);
  return {norm, rot};
}

function parseHTML(html) {
  var parser = new DOMParser();
  var parsed = parser.parseFromString(html, 'text/html');
  const children = parsed.getRootNode().body.children;
  if (children.length != 1) {
    throw new Error(`parseHTML can only parse HTML with 1 child node. Found ${children.length} nodes.`);
  }
  return children[0];
}

function renderCircleGraph(graph, goal, options) {
  options = options || {};
  options.edgeShow = options.edgeShow || (() => true);
  const successorKeys = options.successorKeys;
  /*
  fixedXY: Optional parameter. This requires x,y coordinates that are in
  [-1, 1]. The choice of range is a bit arbitrary; results from code that assumes
  the output of sin/cos.
  */
  // Controls how far the key is from the node center. Scales keyWidth/2.
  const keyDistanceFactor = options.keyDistanceFactor || 1.4;

  const scale = options.scale;
  const width = options.width / scale;
  const height = options.height / scale;

  const xy = graphXY(
    graph,
    width, height,
    // Scales edges and keys in. Good for when drawn in a circle
    // since it can help avoid edges overlapping neighboring nodes.
    options.scaleEdgeFactor || 1,
    options.fixedXY,
  );

  const states = graph.states.map(state => {
    const [x, y] = xy.coordinate[state];
    return stateTemplate(state, {
      probe: state == options.probe,
      goal: state == goal,
      style: `transform: translate(${x - BLOCK_SIZE/2}px,${y - BLOCK_SIZE/2}px);`,
    });
  });

  function addArrow(state, successor, norm, rot) {
      const [x, y] = xy.scaled[state];
      const [sx, sy] = xy.scaled[successor];
      arrows.push(`
        <div class="GraphNavigation-arrow GraphNavigation-edge-${state}-${successor}"
        style="
        transform-origin: center;
        transform:
          translate(${sx-35}px, ${sy-35}px)
          rotate(${rot}rad)
          translate(-30px)
          rotate(90deg)
        ;">
        <svg height="70" width="70" style="display: block; fill: currentColor; stroke: currentColor">
            <polygon points="
            35  , 38
            29  , 50
            41 , 50
          " class="triangle" />
        </svg>
        </div>
      `);
    }

  // HACK for the score animation
  let shadowStates = states.map(state => {
    return state
    .replaceAll("-State-", "-ShadowState-")
    .replaceAll("\"State ", "\"State ShadowState ")
  })

  const succ = [];
  const arrows = [];
  for (const state of graph.states) {
    let [x, y] = xy.scaled[state];
    graph.successors(state).forEach((successor, idx) => {
      const e = xy.edge(state, successor);
      succ.push(`
        <div class="GraphNavigation-edge GraphNavigation-edge-${state}-${successor}" style="
        width: ${e.norm}px;
        transform: translate(${x}px,${y-1}px) rotate(${e.rot}rad);
        "></div>
      `);

      addArrow(state, successor, e.norm, e.rot);
    });
  }

      // width: width / scale,

      // height: height / scale

  // .css({transformOrigin: 'top left', transform: `scale(${scale})`})


  return parseHTML(`
  <div class="GraphNavigation withGraphic"
      style="
        width: ${width}px;
        height: ${height}px;
        transform-origin: top left;
        transform: scale(${scale});
      ">
    ${arrows.join('')}
    ${succ.join('')}
    ${shadowStates.join('')}
    ${states.join('')}
  </div>
  `);
}

function queryEdge(root, state, successor) {
  /*
  Returns the edge associated with nodes `state` and `successor`. Since we only
  have undirected graphs, they share an edge, so some logic is needed to find it.
  */
  return root.querySelector(`.GraphNavigation-edge-${state}-${successor}`);
}

function setCurrentState(display_element, graph, state, options) {
  options = options || {};
  options.edgeShow = options.edgeShow || (() => true);
  // showCurrentEdges enables rendering of current edges/keys. This is off for PathIdentification and AcceptReject.
  options.showCurrentEdges = typeof(options.showCurrentEdges) === 'undefined' ? true : options.showCurrentEdges;
  const allKeys = _.uniq(_.flatten(options.successorKeys));

  // Remove old classes!
  function removeClass(cls) {
    const els = display_element.querySelectorAll('.' + cls);
    for (const e of els) {
      e.classList.remove(cls);
    }
  }
  removeClass('GraphNavigation-current')
  removeClass('GraphNavigation-currentEdge')
  // removeClass('GraphNavigation-currentKey')
  for (const key of allKeys) {
    removeClass(`GraphNavigation-currentEdge-${keyForCSSClass(key)}`)
    // removeClass(`GraphNavigation-currentKey-${keyForCSSClass(key)}`)
  }

  // Can call this to clear out current state too.
  if (state == null) {
    return;
  }

  // Add new classes! Set current state.
  display_element.querySelector(`.GraphNavigation-State-${state}`).classList.add('GraphNavigation-current');

  if (!options.showCurrentEdges) {
    return;
  }

  if (options.onlyShowCurrentEdges) {
    for (const el of display_element.querySelectorAll('.GraphNavigation-edge,.GraphNavigation-arrow')) {
      el.style.opacity = 0;
    }
  }

  graph.successors(state).forEach((successor, idx) => {
    if (!options.edgeShow(state, successor)) {
      return;
    }

    // Set current edges
    let el = queryEdge(display_element, state, successor);
    el.classList.add('GraphNavigation-currentEdge');
    if (options.onlyShowCurrentEdges) {
      el.style.opacity = 1;
    }
  });
}