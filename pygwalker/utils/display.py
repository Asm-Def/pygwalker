"""display.py
"""
import time
import json
from .render import DataFrameEncoder
from .gwalker_props import getPropGetter
from ..base import Literal, display, HTML,  tp, __hash__, rand_str
from .gwalker_props import FieldSpec, DataFrame

DISPLAY_HANDLER = dict()
def display_html(html: str, env: Literal['Jupyter', 'Streamlit', 'Widgets'] = 'Jupyter', *,
                 slot_id: str=None):
    """Judge the presentation method to be used based on the context

    Args:
        - html (str): html string to display.
        - env: (Literal['Widgets' | 'Streamlit' | 'Jupyter'], optional): The enviroment using pygwalker
        *
        - slot_id(str): display with given id.
    """
    # pylint: disable=import-outside-toplevel
    if env == 'Jupyter':
        if slot_id is None:
            display(HTML(html))
        else:
            handler = DISPLAY_HANDLER.get(slot_id)
            if handler is None:
                handler = display(HTML(html), display_id=slot_id)
                DISPLAY_HANDLER[slot_id] = handler
            else:
                handler.update(HTML(html))
    elif env == 'Streamlit':
        import streamlit.components.v1 as components
        components.html(html, height=1000, scrolling=True)
    elif env == 'Widgets':
        import ipywidgets as wgt # pylint: disable=unused-import
    else:
        print('The environment is not supported yet, Please use the options given')

def send_js(js_code):
    nonlocal cur_slot
    # import html as m_html
    # js_code = m_html.escape(js_code)
    display_html(
        f"""<style onload="(()=>{{let f=()=>{{{js_code}}};setTimeout(f,0);}})();this.remove()" />""", env, slot_id=display_slots[cur_slot])
    cur_slot = (cur_slot + 1) % slot_cnt
    
def send_msg(msg):
    msg = json.loads(json.dumps(msg, cls=DataFrameEncoder))
    js_code = f"document.getElementById('gwalker-{gid}')?"\
        ".contentWindow?"\
        f".postMessage({msg}, '*');"
    # display(Javascript(js));
    # js = m_html.escape(js)
    send_js(js_code)

# TODO: def display_app( html: str)

async def append_data(
    html: str, df: DataFrame, last_props: tp.Dict[str, any], gid: tp.Union[int, str]=None, *,
        env: Literal['Jupyter', 'Streamlit']='Jupyter', fieldSpecs: tp.Dict[str, FieldSpec] = None, **kwargs):
    if fieldSpecs is None:
        fieldSpecs = {}
    def rand_slot_id():
        return __hash__ + '-' + rand_str(6)
    slot_cnt, cur_slot = 8, 0
    display_slots = [rand_slot_id() for _ in range(slot_cnt)]

    l = len(df)
    caution_id = __hash__ + rand_str(6)
    progress_id = __hash__ + rand_str(6)
    progress_hint = 'Dynamically loading into the frontend...'
    sample_data = last_props.get('dataSource', [])
    ds_props = last_props['dataSourceProps']
    if l > len(sample_data):
        display_html(f"""<div id="{caution_id}">Dataframe is too large for ipynb files. """\
            f"""Only {len(sample_data)} sample items are printed to the file.</div>""",
                env, slot_id=caution_id)
        display_html(f'{progress_hint} {len(sample_data)}/{l}', env, slot_id=progress_id)
    display_html(html, env)
    # time.sleep(1)
    # print("send_msg")
    # send_msg({'action': 'dataReady', 'tunnelId': 'tunnel!', 'dataSourceId': 'dataSource!' })
    if l > len(sample_data):
        # static output is truncated.
        time.sleep(0.1)
        chunk = 1 << 14
        prop_getter = getPropGetter(df)
        df = prop_getter.escape_fname(df, env=env, fieldSpecs=fieldSpecs, **kwargs)
        records = prop_getter.to_records(df)
        # matrix = prop_getter.to_matrix(df)
        for i in range(len(sample_data), l, chunk):
            # s = df[i: min(i+chunk, l)]
            # data = prop_getter.to_records(s)
            data = records[i: min(i+chunk, l)]
            # data = matrix[i: min(i+chunk, l)]
            msg = {
                'action': 'postData',
                'tunnelId': ds_props['tunnelId'],
                'dataSourceId': ds_props['dataSourceId'],
                'data': data,
            }
            send_msg(msg)
            display_html(f'{progress_hint} {min(i+chunk, l)}/{l}', env, slot_id=progress_id)
            # time.sleep(1e-3)
        msg = {
            'action': 'finishData',
            'tunnelId': ds_props['tunnelId'],
            'dataSourceId': ds_props['dataSourceId'],
        }
        send_msg(msg)
        time.sleep(0.5)
        display_html('', env, slot_id=progress_id)
        send_js(f"""document.getElementById("{caution_id}")?.remove()""")
        for i in range(cur_slot, slot_cnt):
            display_html('', env, slot_id=display_slots[i])
        for i in range(cur_slot):
            display_html('', env, slot_id=display_slots[i])
