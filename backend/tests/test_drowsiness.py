from vision_app.drowsiness import EyeTimeline


def test_sustained_closure_and_reopening():
    timeline = EyeTimeline()
    for t in [0, .5, 1, 1.5]:
        assert not timeline.update('a', True, t)['alert']
    assert timeline.update('a', True, 2)['alert']
    assert timeline.update('a', False, 2.5)['closedSeconds'] == 0


def test_missing_data_gap_and_camera_isolation():
    timeline = EyeTimeline()
    timeline.update('a', True, 0)
    timeline.update('a', True, 1)
    assert timeline.update('b', True, 1)['closedSeconds'] == 0
    assert timeline.update('a', None, 1.5)['status'] == 'insufficient_data'
    assert timeline.update('a', True, 2)['closedSeconds'] == 0
    assert timeline.update('a', True, 5)['closedSeconds'] == 0


def test_still_images_never_accumulate():
    timeline = EyeTimeline()
    for t in range(10):
        assert not timeline.update(None, True, t)['alert']
    assert not timeline.sessions
