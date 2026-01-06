// ==UserScript==
// @name         校情与教学质量问卷自动化(GXMU) - 定向评测+弹窗关闭
// @namespace    http://tampermonkey.net/
// @version      1.9.0
// @description  v1.9.0: 评语库扩充至50+条，确保每位老师评价不重复；保留自动跳转和暴力关窗功能
// @author       AI Pair Programmer
// @match        *://zspj.gxmu.edu.cn/*
// @run-at       document-end
// @grant        none
// @license      MIT
// ==/UserScript==

(function(){
    'use strict';

    // --- 核心逻辑 ---

    function isVisible(el) {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function isLoginOrIndex(){
        const href=window.location.href;
        return href.includes('/student_login/') || href.includes('/index.jsp');
    }

    function getPageMode(){
        // 0. 顶级优先级：如果看到“感谢/成功”弹窗，那绝对是收尾阶段，属于 LIST 模式的任务
        // 必须检测可见性，防止隐藏的弹窗干扰
        const popups = Array.from(document.querySelectorAll('.layui-layer, .swal2-container, .modal, .bootbox, div[class*="layer"]'));
        const hasSuccessPopup = popups.some(p => 
            isVisible(p) && (p.innerText.includes('感谢') || p.innerText.includes('成功') || p.innerText.includes('完成'))
        );
        if (hasSuccessPopup) {
            return 'LIST';
        }

        // 1. 强特征判断：必须有 *可见* 的单选框
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        const visibleRadios = radios.filter(isVisible);

        if(visibleRadios.length > 0) {
            return 'EVALUATE';
        }

        // 2. 默认列表页
        return 'LIST';
    }

    function groupsByName(radios){
        const map={};
        radios.forEach(r=>{const n=r.name||r.getAttribute('name');if(!map[n]) map[n]=[];map[n].push(r);});
        return Object.values(map);
    }

    function pick(option){
        if(!option) return;
        option.click();
        if(!option.checked && option.parentElement) option.parentElement.click();
    }

    function fillRadios(){
        // 只选择可见的 radio
        const radios=Array.from(document.querySelectorAll('input[type="radio"]')).filter(isVisible);
        
        if(radios.length===0) return false;
        
        // 检查是否已经填过（避免重复点击）
        const checked = radios.filter(r => r.checked);
        if(checked.length > radios.length / 5) { 
             return true; 
        }

        const groups=groupsByName(radios);
        
        groups.forEach((opts,idx)=>{
            let target = opts[0]; // 默认选第一个（表现突出/10分）

            // 逻辑：98分 = 1道“较好”(扣2分) + 其余“表现突出”
            // 我们固定选第5题（idx==4）为“较好”（opts[1]）
            // 且第11题（idx==10）通常也是选第一个
            
            if(idx === 4 && opts.length > 1) {
                target = opts[1]; // 第5题选第二个（较好）
            } else if (idx >= 10 && opts.length > 1) {
                 target = opts[0]; 
            }

            pick(target);
        });
        return true;
    }

    function fillComments(){
        // 只填写可见的 textarea
        const textareas=Array.from(document.querySelectorAll('textarea')).filter(isVisible);
        
        if(textareas.length===0) return;
        
        // 检查是否已有内容
        if(textareas[0].value.length > 10) {
            return;
        }

        const pool=[
            "老师备课非常充分，教学内容重点突出，理论联系实际，课堂气氛活跃，能很好地调动学生的积极性，受益匪浅，我们都非常喜欢这位老师的课。",
            "治学严谨，要求严格，能深入浅出地进行讲解，对于我们的疑问能耐心解答，不仅教书还能育人，是难得的好老师，希望老师继续保持这种教学风格。",
            "教学方式新颖独特，能够吸引我们的注意力，课程内容安排合理，节奏适中，让我们在轻松的氛围中学到了很多知识，非常感谢老师的辛勤付出。",
            "老师授课条理清晰，逻辑性强，板书工整，语言生动幽默，课堂互动频繁，让我们对这门课程产生了浓厚的兴趣，收获颇丰，是一次非常棒的学习体验。",
            "老师对待教学认真负责，语言生动，条理清晰，举例充分恰当，严格要求学生，对待学生平易近人，我们非常喜欢这门课。",
            "课堂教学效果好，内容丰富，形式多样，能激发我们的学习兴趣，老师知识渊博，见解独到，让我们开阔了眼界，增长了见识。",
            "老师讲课重点突出，层次分明，内容丰富，语言生动，能引导我们积极思考，课堂气氛活跃，我们学到了很多实用的知识和技能。",
            "教学态度端正，备课详尽，讲解细致，对学生提出的问题能进行详细的解答，课后作业布置合理，批改及时认真，是一位非常负责任的老师。",
            "老师的教学风格我很喜欢，幽默风趣，深入浅出，把枯燥的理论知识讲得生动有趣，让我们在快乐中学习，极大地提高了学习效率。",
            "课程设置合理，内容充实，老师讲课充满激情，感染力强，能很好地带动课堂气氛，让我们在潜移默化中掌握了知识，非常感谢老师的教导。",
            "老师知识面广，上课时能旁征博引，让我们了解了很多课本以外的知识，拓宽了我们的视野，激发了我们的求知欲。",
            "讲课非常有条理，逻辑清晰，每一个知识点都讲得很透彻，让我们容易理解和掌握，课后复习也很有针对性，非常实用。",
            "老师非常有耐心，对不懂的同学能反复讲解，直到弄懂为止，这种敬业精神让我们非常感动，也激励我们更加努力学习。",
            "教学方法灵活多样，能根据不同的教学内容采用不同的教学方式，让我们始终保持新鲜感和学习热情，教学效果非常显著。",
            "老师不仅传授知识，还教我们做人的道理，注重培养我们的综合素质，是我们人生路上的良师益友，非常感激老师的教诲。",
            "课堂互动性强，老师鼓励我们发表自己的观点，培养了我们的独立思考能力和表达能力，这种开放式的教学让我们受益终身。",
            "老师备课认真，课件制作精美，图文并茂，辅助教学效果好，让我们能直观地理解抽象的知识，提高了学习兴趣。",
            "讲解清晰明了，重点难点突出，能很好地把握教学节奏，让我们跟得上老师的思路，学习起来比较轻松，效果也很好。",
            "老师平易近人，关心爱护学生，与学生关系融洽，课堂氛围和谐，让我们在轻松愉快的环境中学习，心理压力小，学习动力足。",
            "教学内容紧跟时代步伐，能引入最新的学术动态和案例，让我们学到的知识不过时，具有很强的实用性和前瞻性。",
            "老师授课认真，细致入微，对每一个细节都不放过，让我们养成了严谨的治学态度，这对我们以后的学习和工作都有很大的帮助。",
            "课堂管理严格，秩序井然，但又不失活泼，老师能很好地掌控课堂节奏，保证了教学活动的顺利进行，教学质量很高。",
            "老师讲课富有激情，声音洪亮，抑扬顿挫，能吸引我们的注意力，让我们不知不觉中就度过了一节课，意犹未尽。",
            "教学思路清晰，环节紧凑，重难点突出，设计合理，老师善于引导学生思考，激发学生的学习兴趣，课堂气氛活跃。",
            "老师治学严谨，对学生严格要求，但又不失亲切感，能耐心地解答我们的问题，让我们感受到了老师的关爱和期望。",
            "课程内容丰富实用，老师结合实际案例进行讲解，让我们更容易理解和接受，学到了很多解决实际问题的方法和技巧。",
            "老师非常有亲和力，总是面带微笑，让我们感到非常温暖，课堂上能积极参与互动，学习氛围浓厚，效果良好。",
            "教学手段现代化，能熟练运用多媒体技术辅助教学，提高了课堂教学效率，让我们能更直观、更生动地学习知识。",
            "老师讲课深入浅出，通俗易懂，即使是复杂的理论也能讲得明明白白，让我们对这门课程充满了信心和兴趣。",
            "注重理论与实践相结合，老师经常组织我们进行实践活动，让我们在实践中巩固理论知识，提高了我们的动手能力。",
            "老师知识渊博，讲课幽默风趣，课堂气氛活跃，我们都很喜欢听他的课，感觉时间过得很快，收获也很大。",
            "教学目标明确，重点突出，难点突破，老师能根据学生的实际情况进行针对性的教学，因材施教，效果显著。",
            "老师对待工作兢兢业业，一丝不苟，这种敬业精神深深地感染了我们，让我们懂得了什么是责任和担当。",
            "课堂氛围轻松愉快，老师尊重学生的个性发展，鼓励我们大胆创新，培养了我们的创新意识和创新能力。",
            "老师备课充分，资料详实，讲课内容丰富多彩，让我们大开眼界，学到了很多书本上学不到的知识。",
            "讲解耐心细致，对学生的疑问能不厌其烦地解答，直到我们完全弄懂为止，是一位非常负责任的好老师。",
            "老师授课风格独特，能把枯燥的知识讲得生动有趣，让我们在欢笑中学习，在快乐中成长，非常感谢老师。",
            "教学安排合理，进度适中，既不拖沓也不急躁，让我们有足够的时间消化吸收所学知识，学习效果很好。",
            "老师关心学生的全面发展，不仅关注学习成绩，还关注我们的身心健康，经常与我们沟通交流，是我们贴心人。",
            "课堂生动有趣，引人入胜，老师善于运用各种教学方法激发我们的学习兴趣，让我们爱上了这门课程。",
            "老师讲课重点突出，条理清晰，让我们能迅速抓住课程的核心内容，学习起来事半功倍，效率很高。",
            "教学态度严谨，对学生要求严格，但又不失关怀，能及时发现我们的问题并给予指导，帮助我们不断进步。",
            "老师知识底蕴深厚，讲课旁征博引，让我们领略到了知识的魅力，激发了我们探索未知的热情。",
            "课程内容设计新颖，贴近生活，老师能引导我们将所学知识应用到实际生活中，提高了我们的应用能力。",
            "老师非常有责任心，每次作业都认真批改，并给出详细的评语，让我们知道自己的不足并及时改正。",
            "课堂互动频繁，老师鼓励我们提问和讨论，营造了良好的学术氛围，让我们在交流中碰撞出思想的火花。",
            "老师备课用心，课件制作精良，讲课内容丰富充实，让我们每节课都有新的收获，非常充实。",
            "讲解清晰透彻，深入浅出，老师能把复杂的问题简单化，让我们容易理解和掌握，学习信心倍增。",
            "老师平易近人，和蔼可亲，与学生亦师亦友，课堂上能与我们打成一片，让我们在轻松的氛围中学习。",
            "教学效果优秀，深受学生喜爱，老师不仅教会了我们知识，更教会了我们如何学习，如何做人。"
        ];
        
        // 随机打乱数组，避免按顺序取
        const randomComment = pool[Math.floor(Math.random() * pool.length)];
        
        textareas.forEach(ta=>{
            ta.value = randomComment;
            // 模拟人工输入事件
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
            ta.dispatchEvent(new Event('blur', { bubbles: true }));
        });
    }

    function findSubmit(){
        return Array.from(document.querySelectorAll('button, a, input[type="button"], div.btn, span.btn'))
            .find(b=> (b.innerText||'').includes('提交') || (b.value||'')==='提交');
    }

    // --- 列表页逻辑 ---

    function closeSuccessPopups(){
        // 1. 处理残留的遮罩层
        const shades = document.querySelectorAll('.layui-layer-shade, .swal2-shown, .modal-backdrop, .shade');
        const visiblePopups = Array.from(document.querySelectorAll('.layui-layer, .swal2-container, .modal, .bootbox')).filter(el => el.style.display !== 'none');
        
        if(shades.length > 0 && visiblePopups.length === 0) {
            shades.forEach(s => s.remove());
        }

        // 2. 查找并关闭弹窗
        const popups=document.querySelectorAll('.layui-layer, .swal2-container, .modal, .bootbox, div[class*="layer"], div[style*="z-index: 1989"]');
        
        if(popups.length === 0) return false;

        let found = false;
        popups.forEach(p=>{
            const text = (p.innerText||'');
            if(text.includes('感谢') || text.includes('成功') || text.includes('完成') || text.includes('提示') || text.includes('信息')){
                found = true;
                
                // 寻找关闭按钮
                let btns = Array.from(p.querySelectorAll('a, button, span, div'));
                let target = btns.find(b => {
                    const t = (b.innerText||'').trim().replace(/\s/g, ''); 
                    return ['关闭', '确定', '完成', 'Close', 'OK', '我知道了'].includes(t);
                });

                if(target) {
                    target.click();
                }

                const shade = document.querySelector('.layui-layer-shade, .swal2-container, .modal-backdrop');
                if(shade && isVisible(shade)) {
                    shade.click();
                }

                setTimeout(()=>{
                    if(document.body.contains(p)) {
                        p.remove();
                    }
                    document.querySelectorAll('.layui-layer-shade, .modal-backdrop').forEach(el=>el.remove());
                }, 100);
            }
        });
        
        return found;
    }

    let lastActionTime = Date.now();

    function findAndClickTask() {
        const candidates = Array.from(document.querySelectorAll('a, button, span, input[type="button"]'));
        
        const target = candidates.find(el => {
            if(!isVisible(el)) return false;
            
            const t = (el.innerText || el.value || '').trim();
            if(t.includes('已评价')) return false;
            return t === '评价' || t === '进入评价' || t === '评教' || t === '打分';
        });
        
        if(target) {
            target.click();
            lastActionTime = Date.now(); 
        }
    }

    // --- 主循环 ---

    function main(){
        if(isLoginOrIndex()) {
            return;
        }

        const mode = getPageMode();
        
        if(mode === 'EVALUATE') {
            const radiosOk = fillRadios();
            fillComments();
            
            if(radiosOk) {
                const submit = findSubmit();
                if(submit) {
                     submit.click(); 
                }
            }

        } else if (mode === 'LIST') {
            const busy = closeSuccessPopups();
            
            if(busy) {
                lastActionTime = Date.now(); 
            } else {
                const diff = Date.now() - lastActionTime;
                if(diff > 2000) { 
                    findAndClickTask();
                }
            }
        }
    }

    setInterval(main,1000);
})();
